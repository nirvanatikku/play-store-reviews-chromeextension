// Copyright (c) 2014 Nirvana Tikku
//
// A chrome extension utility to scrape the play store reviews.
// Don't judge. This is a simple utility; and there is no guarantee that
// the structure of the reviews will remain intact forever so I 
// anticipate that this will change somewhat frequently.
//
// As of right now, a PlayStoreReview object looks like ---
// 
// PlayStoreReview = {
//    stars: '',
//    author: '',
//    date: '',
//    time: '',
//    title: '',
//    text: ''
// }
// 
// I know, i know. They're all strings.

//
// PlayStoreReview - the object that contains all the necessary info
// of a review.
//
var PlayStoreReview = function(node){
  var that = this;
  // appdata. pretty awesome, right? 
  var appdata = node.parentNode.parentNode.parentNode
                  .getElementsByTagName('td')[0]
                  .getElementsByTagName('div')[0]
                  .getElementsByTagName('div')[0]
                  .getElementsByTagName('p');
  this.stars = appdata[0].title.split(' ')[0];
  if(appdata.length>1){
    var nextSection = appdata[1].textContent;
    if(nextSection.indexOf('App v')===0){
        this.version = nextSection.replace('App version ','');
    } else {
        this.device = nextSection;
    }
  }
  if(appdata.length>2 && !this.device){
    this.device = appdata[2].textContent;
  }
  // info
  var info = node.getElementsByTagName('strong');
  this.author = info[0].textContent;
  this.date = info[1].textContent;
  this.time = info[2].textContent;
  // text
  var text = node.getElementsByTagName('p')[0].textContent;
  this.title = "";
  this.text = "";
  if(text.length>0){
    var titleIndex = text.indexOf('\t');
    if(titleIndex>-1){
      this.title = text.substring(0,titleIndex);
      this.text = text.substring(titleIndex+'\t'.length);
    } else {
      this.text = text;
    }
  }
  if(this.text){
    // TODO: should really maintain the original language
    this.text = this.text.replace(' Show original review','');
  }
  this.isTheSameAs = function isTheSameAs(review){
    if(review.stars == that.stars && 
        review.author == that.author &&
        review.date == that.date &&
        review.time == that.time){
      return true;
    }
    return false;
  }
  this.toJSON = function toJSON(){
    var ret = {};
    for(var prop in that){
      if(that.hasOwnProperty(prop)){
        var v = that[prop];
        if(typeof(v) !== 'function'){
          ret[prop] = v;
        }
      }
    }
    return ret;
  }
};

//
// Global Data
//
var PlayerStoreData = {};
PlayerStoreData.reviews = [];

//
//
// As this is a content script, we will load 
// the utilities for scraping the play store.
// The utility will be a browser_action button
// and will load the play store (if not the current window)
// or (1) ask the user for the app to use on the home
// screen; (2) simply scrape the reviews if on the reviews page
//
//
var PlayStoreScraper = {};

//
// Config params
//
var PlayStoreScraperConfig = {
  'delayTimeout': 1500,
  'nextpageDelayTimeout': 2500,
  'playStoreURI': 'play.google.com/apps/publish',
  'reviewExpr': '[data-column="review"]',
  'nextPageText': '▶',
  'reviewsURIFragment': 'ReviewsPlace',
  'homeURIFragment': 'AppListPlace',
  'packageSep': ':p='
};

//
// PlayStoreScraper.init
// Initializes and kicks off the scraper
//
PlayStoreScraper.init = function init(){
  var url = window.location.href;
  if(url.indexOf(PlayStoreScraperConfig.playStoreURI)>-1){
    PlayStoreScraper.go(window, document);
  }
};

//
//
// PlayStoreScraper.getReviews
// Our method to basically cycle through all pages and get the reviews
// 
//
PlayStoreScraper.getReviews = function getReviews(){
  var nextButtonId = PlayStoreScraper.getNextButton();
  if(nextButtonId == null){
    console.log("error: couldn't find next button");
    return;
  }
  var reviews = document.querySelectorAll(PlayStoreScraperConfig.reviewExpr);
  if(reviews.length===0){
    return;
  }
  var review, psr;
  for(var i=0; i<reviews.length; i++){
      review = reviews[i];
      psr = new PlayStoreReview(review);
      if(PlayerStoreData.reviews.length > 0 && 
          PlayerStoreData.reviews.length > reviews.length &&
          PlayerStoreData.reviews[PlayerStoreData.reviews.length-reviews.length].isTheSameAs(psr)){
        PlayStoreScraper.done();
        return;
      }
      PlayerStoreData.reviews.push(psr);
  }
  PlayStoreScraper.notifyBackground();
  nextButtonId.click();
  setTimeout(PlayStoreScraper.getReviews,PlayStoreScraperConfig.nextpageDelayTimeout);
}

//
// PlayStoreScraper.getNextButton
// A method to find the next button. This is dependent on the design.
//
PlayStoreScraper.getNextButton = function getNextButton(){
  var buttons = document.getElementsByTagName('button');
  var nextButton = null;
  for(var i=0; buttons.length; i++){
    if(buttons[i].textContent.indexOf(PlayStoreScraperConfig.nextPageText)>-1){
      nextButton = buttons[i];
      break;
    }
  }
  return nextButton;
};

//
// PlayStoreScraper.go 
// A method that will guide the user to the reviews scraper
//
PlayStoreScraper.go = function go(win, doc){

  var options = [], opts = [];
  var loc = win.location.href;
  var homeIndex = loc.indexOf('#'+PlayStoreScraperConfig.homeURIFragment);
  var reviewsIndex = loc.indexOf('#'+PlayStoreScraperConfig.reviewsURIFragment);

  // if on the first page... select an app
  if(homeIndex>-1){
    var links = doc.querySelectorAll('a');
    var lnk;
    for(var l=0; l<links.length; l++){
      lnk = links[l];
      if(lnk.href.indexOf(PlayStoreScraperConfig.reviewsURIFragment)>-1){
        var app = lnk.parentNode.parentNode.parentNode.getElementsByTagName('td')[0].textContent;
        options.push({'app':app,'reviewlink':lnk});
        opts.push((opts.length+1)+'.\t'+app);
      }
    }
    var option = 0;
    if(options.length>1){
      option = prompt('Pick one of the following apps to download reviews for:\n'+opts.join('\n'));
    } 
    try { 
      options[option-1]['reviewlink'].click();
      setTimeout(PlayStoreScraper.getReviews,PlayStoreScraperConfig.delayTimeout);
    } catch (ex) { 
      console.log('no app specified...');
    }
  } 
  // or if we're already on the reviews page
  else if (reviewsIndex>-1) {
    setTimeout(PlayStoreScraper.getReviews,PlayStoreScraperConfig.delayTimeout);
  }

};

//
// PlayStoreScraper.done
// When done, we will present the user with the reviews.
//
PlayStoreScraper.done = function done(){
  
  // file name
  var pkg = window.location.href;
  pkg = pkg.substring(pkg.indexOf(PlayStoreScraperConfig.packageSep)+PlayStoreScraperConfig.packageSep.length);
  var d = new Date();
  var ts = (d.getUTCMonth()+1)+'.'+d.getUTCDate()+'.'+d.getUTCFullYear();

  alert("Done gathering "+PlayerStoreData.reviews.length+" reviews. Downloading zip now...");
  
  var reviewLines = [];
  for(var r=0; r<PlayerStoreData.reviews.length; r++){
    reviewLines.push(PlayerStoreData.reviews[r].toJSON());
  }
  
  // zip up the download
  var zip = new JSZip();
  zip.file('appreviews_'+pkg+'_'+ts+'.json', JSON.stringify(reviewLines));
  var blob = zip.generate({type:"blob"});

  // download
  window.location.href = window.URL.createObjectURL(blob);

}

PlayStoreScraper.notifyBackground = function notifyBackground(){
  chrome.runtime.sendMessage({numReviews:String(PlayerStoreData.reviews.length)});
}

//
// When the doc is ready, init our PlayStoreScraper.
//
document.onreadystatechange = function() {
    if (document.readyState === 'complete') {
      // setTimeout(PlayStoreScraper.init,2000);
      PlayStoreScraper.notifyBackground();
      chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
          if (request.numReviews)
            PlayStoreScraper.notifyBackground();
        });
    }
};