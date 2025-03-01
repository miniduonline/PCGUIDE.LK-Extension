// background.js - Updated to fetch and store featured images
// Set up alarm to fetch posts regularly
chrome.runtime.onInstalled.addListener(() => {
  // Check for updates every 30 minutes
  chrome.alarms.create('fetch-posts', { periodInMinutes: 30 });
  
  // Initialize theme settings if not set
  chrome.storage.local.get(['darkMode'], function(data) {
    if (data.darkMode === undefined) {
      chrome.storage.local.set({ darkMode: false });
    }
  });
  
  // Do an initial fetch
  fetchPosts();
});

// Handle the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fetch-posts') {
    fetchPosts();
  }
});

// Function to fetch posts
function fetchPosts() {
  fetch('https://pcguide.lk/wp-json/wp/v2/posts?per_page=5&_embed')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(posts => {
      const formattedPosts = posts.map(post => {
        // Extract featured image if available
        let featuredImageUrl = null;
        if (post._embedded && 
            post._embedded['wp:featuredmedia'] && 
            post._embedded['wp:featuredmedia'][0] &&
            post._embedded['wp:featuredmedia'][0].media_details &&
            post._embedded['wp:featuredmedia'][0].media_details.sizes) {
          
          // Try to get medium size first, then thumbnail, then full as fallback
          const sizes = post._embedded['wp:featuredmedia'][0].media_details.sizes;
          if (sizes.medium) {
            featuredImageUrl = sizes.medium.source_url;
          } else if (sizes.thumbnail) {
            featuredImageUrl = sizes.thumbnail.source_url;
          } else if (post._embedded['wp:featuredmedia'][0].source_url) {
            featuredImageUrl = post._embedded['wp:featuredmedia'][0].source_url;
          }
        }
        
        return {
          id: post.id,
          title: post.title.rendered,
          excerpt: post.excerpt.rendered.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 100) + "...",
          link: post.link,
          date: new Date(post.date),
          featuredImage: featuredImageUrl,
          isNew: false
        };
      });
      
      // Check which posts are new
      chrome.storage.local.get(['posts'], function(data) {
        if (data.posts) {
          const oldPostIds = new Set(data.posts.map(p => p.id));
          let hasNewPosts = false;
          
          formattedPosts.forEach(post => {
            post.isNew = !oldPostIds.has(post.id);
            if (post.isNew) hasNewPosts = true;
          });
          
          // If there are new posts, update the badge
          if (hasNewPosts) {
            chrome.action.setBadgeText({ text: "NEW" });
            chrome.action.setBadgeBackgroundColor({ color: "#4285F4" });
          }
        } else {
          // First run, mark all as new
          formattedPosts.forEach(post => post.isNew = true);
          chrome.action.setBadgeText({ text: "NEW" });
          chrome.action.setBadgeBackgroundColor({ color: "#4285F4" });
        }
        
        // Store the updated posts
        chrome.storage.local.set({ posts: formattedPosts });
      });
    })
    .catch(error => {
      console.error('Error fetching posts:', error);
    });
}

// Listen for badge reset
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clearBadge') {
    chrome.action.setBadgeText({ text: "" });
  } else if (message.action === 'checkForUpdates') {
    fetchPosts();
    sendResponse({ status: 'Checking for updates...' });
  }
  return true; // Indicates async response
});

// Handle installation and update events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open a welcome page or show onboarding
    chrome.tabs.create({ url: 'welcome.html' });
  } else if (details.reason === 'update') {
    // Could show update notes or changelog
    console.log('Extension updated from version', details.previousVersion);
  }
});