
chrome.browserAction.setBadgeBackgroundColor({'color':'#3399cc'});
chrome.browserAction.setBadgeText({'text':''});
chrome.browserAction.onClicked.addListener(function(tab) {
  var go = "if(typeof(PlayStoreScraper)!=='undefined'){"+
                "PlayStoreScraper.go(window,document);"+
            "} else { "+
                "window.location.href = 'https://play.google.com/apps/publish/';"+
            "}";
  chrome.tabs.executeScript(null, {code:go});
});
chrome.tabs.onActivated.addListener(function(tabInfo) {
    chrome.tabs.query({active:true,currentWindow:true},function(tabs){
        var txt = '?';
        if(tabs && tabs[0].url.indexOf('play.google.com/apps/publish')>-1){
            txt = '0';
            chrome.tabs.sendMessage(tabs[0].id, {numReviews: "?"}, function(response) {
                chrome.browserAction.setBadgeText({'text':request.numReviews});
            });
        }
        chrome.browserAction.setBadgeText({'text':txt});
    });
});
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
        console.log(request);
        console.log(request.numReviews);
    if (request.numReviews){
      chrome.browserAction.setBadgeText({'text':request.numReviews});
    }
  });