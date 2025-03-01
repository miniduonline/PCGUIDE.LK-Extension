// popup.js - Enhanced with dark mode toggle and refresh button
document.addEventListener('DOMContentLoaded', function() {
  // Clear badge when popup opens
  chrome.action.setBadgeText({ text: "" });
  
  // DOM elements
  const postsContainer = document.getElementById('posts-container');
  const loadingElement = document.getElementById('loading');
  const errorMessage = document.getElementById('error-message');
  const lastUpdatedElement = document.getElementById('last-updated');
  const gotoSiteButton = document.getElementById('goto-site');
  const refreshButton = document.getElementById('refresh-btn');
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  
  // Initialize UI
  loadingElement.style.display = 'flex';
  postsContainer.style.display = 'none';
  errorMessage.style.display = 'none';
  
  // Load theme preference
  chrome.storage.local.get(['darkMode'], function(data) {
    if (data.darkMode) {
      document.body.setAttribute('data-theme', 'dark');
      themeIcon.classList.remove('fa-moon');
      themeIcon.classList.add('fa-sun');
    } else {
      document.body.setAttribute('data-theme', 'light');
      themeIcon.classList.remove('fa-sun');
      themeIcon.classList.add('fa-moon');
    }
  });
  
  // Theme toggle event listener
  themeToggle.addEventListener('click', function() {
    // Add transition class to body for smooth transition
    document.body.classList.add('theme-transition');
    
    if (document.body.getAttribute('data-theme') === 'dark') {
      document.body.setAttribute('data-theme', 'light');
      themeIcon.classList.remove('fa-sun');
      themeIcon.classList.add('fa-moon');
      chrome.storage.local.set({ darkMode: false });
    } else {
      document.body.setAttribute('data-theme', 'dark');
      themeIcon.classList.remove('fa-moon');
      themeIcon.classList.add('fa-sun');
      chrome.storage.local.set({ darkMode: true });
    }
    
    // Remove transition class after transition completes
    setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 500);
  });
  
  // Refresh button event listener
  refreshButton.addEventListener('click', function() {
    if (refreshButton.classList.contains('refreshing')) {
      return; // Prevent multiple clicks
    }
    
    // Add refreshing animation
    refreshButton.classList.add('refreshing');
    
    // Clear the container
    postsContainer.style.display = 'none';
    loadingElement.style.display = 'flex';
    errorMessage.style.display = 'none';
    
    // Fetch new posts
    fetchLatestPosts().then(() => {
      // Remove refreshing animation
      setTimeout(() => {
        refreshButton.classList.remove('refreshing');
      }, 1000);
    });
  });
  
  // Fetch posts from storage
  chrome.storage.local.get(['posts', 'lastUpdated'], function(data) {
    if (data.lastUpdated) {
      const lastUpdated = new Date(data.lastUpdated);
      lastUpdatedElement.textContent = lastUpdated.toLocaleTimeString() + ' ' + lastUpdated.toLocaleDateString();
    }
    
    if (data.posts && data.posts.length > 0) {
      displayPosts(data.posts);
      loadingElement.style.display = 'none';
      postsContainer.style.display = 'block';
      
      // Also fetch fresh data
      fetchLatestPosts();
    } else {
      // No cached data, fetch fresh data
      fetchLatestPosts();
    }
  });
  
  // Go to website button
  gotoSiteButton.addEventListener('click', function() {
    chrome.tabs.create({ url: 'https://pcguide.lk' });
  });
  
  // Function to fetch latest posts
  function fetchLatestPosts() {
    // Return a promise so we can handle loading state
    return new Promise((resolve, reject) => {
      // Fetch with media embedded for featured images
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
              isNew: false // We'll determine this later
            };
          });
          
          // Check which posts are new since last update
          chrome.storage.local.get(['posts'], function(data) {
            if (data.posts) {
              const oldPostIds = new Set(data.posts.map(p => p.id));
              formattedPosts.forEach(post => {
                post.isNew = !oldPostIds.has(post.id);
              });
            }
            
            // Save to storage
            const now = new Date();
            chrome.storage.local.set({
              posts: formattedPosts, 
              lastUpdated: now.toISOString()
            });
            
            // Update UI
            displayPosts(formattedPosts);
            loadingElement.style.display = 'none';
            postsContainer.style.display = 'block';
            lastUpdatedElement.textContent = now.toLocaleTimeString() + ' ' + now.toLocaleDateString();
            
            resolve(); // Resolve the promise
          });
        })
        .catch(error => {
          console.error('Error fetching posts:', error);
          loadingElement.style.display = 'none';
          
          // If we have cached posts, show them
          chrome.storage.local.get(['posts'], function(data) {
            if (data.posts && data.posts.length > 0) {
              displayPosts(data.posts);
              postsContainer.style.display = 'block';
            } else {
              errorMessage.style.display = 'block';
            }
            
            resolve(); // Resolve the promise even on error
          });
        });
    });
  }
  
  // Function to display posts in the UI
  function displayPosts(posts) {
    postsContainer.innerHTML = '';
    
    posts.forEach((post, index) => {
      const postElement = document.createElement('div');
      postElement.className = 'post-item';
      postElement.style.setProperty('--i', index); // For staggered animation
      
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'post-content';
      
      // Create image container
      const imageContainer = document.createElement('div');
      imageContainer.className = 'post-image';
      
      // Create image element if we have a featured image
      if (post.featuredImage) {
        const imageElement = document.createElement('img');
        imageElement.src = post.featuredImage;
        imageElement.alt = post.title;
        imageElement.onerror = function() {
          // If image fails to load, show a placeholder
          this.src = 'icons/placeholder.png';
        };
        imageContainer.appendChild(imageElement);
      } else {
        // No featured image, use a placeholder
        const placeholderImage = document.createElement('img');
        placeholderImage.src = 'icons/placeholder.png';
        placeholderImage.alt = 'No image available';
        imageContainer.appendChild(placeholderImage);
      }
      
      // Create text container
      const textContainer = document.createElement('div');
      textContainer.className = 'post-text';
      
      const titleElement = document.createElement('h2');
      titleElement.textContent = post.title;
      
      if (post.isNew) {
        const newBadge = document.createElement('span');
        newBadge.className = 'new-badge';
        newBadge.textContent = 'NEW';
        titleElement.appendChild(newBadge);
      }
      
      const dateElement = document.createElement('div');
      dateElement.className = 'post-date';
      const postDate = new Date(post.date);
      dateElement.textContent = postDate.toLocaleDateString();
      
      const excerptElement = document.createElement('div');
      excerptElement.className = 'post-excerpt';
      excerptElement.textContent = post.excerpt;
      
      textContainer.appendChild(titleElement);
      textContainer.appendChild(dateElement);
      textContainer.appendChild(excerptElement);
      
      // Assemble the content wrapper
      contentWrapper.appendChild(imageContainer);
      contentWrapper.appendChild(textContainer);
      
      // Add the content wrapper to the post element
      postElement.appendChild(contentWrapper);
      
      // Add click event to open post
      postElement.addEventListener('click', function() {
        chrome.tabs.create({ url: post.link });
      });
      
      postsContainer.appendChild(postElement);
    });
  }
});
