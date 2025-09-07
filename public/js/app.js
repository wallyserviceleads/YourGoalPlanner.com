// Auth0 SPA SDK integration per Auth0 quickstart
let auth0Client = null;

// Fetches the configuration from the server and initializes the Auth0 client
async function configureClient() {
  const response = await fetch("/auth_config.json");
  const config = await response.json();

  auth0Client = await auth0.createAuth0Client({
    domain: config.domain,
    clientId: config.clientId,
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  });
}

// Updates the UI based on the user's authentication state
async function updateUI() {
  const isAuthenticated = await auth0Client.isAuthenticated();

  const loginButton = document.getElementById("btn-login");
  const logoutButton = document.getElementById("btn-logout");
  const gatedContent = document.getElementById("gated-content");

  if (loginButton) loginButton.disabled = isAuthenticated;
  if (logoutButton) logoutButton.disabled = !isAuthenticated;
  if (gatedContent) {
    if (isAuthenticated) {
      gatedContent.classList.remove("hidden");
    } else {
      gatedContent.classList.add("hidden");
    }
  }
}

// Initiates the login flow
async function login() {
  await auth0Client.loginWithRedirect({
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  });
}

// Logs out the user
function logout() {
  auth0Client.logout({
    logoutParams: {
      returnTo: window.location.origin
    }
  });
}

// Bootstraps the application
window.onload = async () => {
  await configureClient();

  if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
    await auth0Client.handleRedirectCallback();
    window.history.replaceState({}, document.title, "/");
  }

  await updateUI();

  const loginButton = document.getElementById("btn-login");
  const logoutButton = document.getElementById("btn-logout");

  if (loginButton) loginButton.addEventListener("click", login);
  if (logoutButton) logoutButton.addEventListener("click", logout);
};
