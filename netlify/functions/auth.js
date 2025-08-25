<!-- If you don't bundle, use the CDN: -->
<script src="https://cdn.auth0.com/js/auth0-spa-js/2.3/auth0-spa-js.production.js"></script>

<script type="module">
  // --- Auth0 config (replace with your real values) ---
  const auth0Config = {
    domain: 'dev-74ja1cuagr1s3c2c.us.auth0.com',
    clientId: 'KvD2HPQsxFeOFIezMtdaAFlFtqBQST8m',
    authorizationParams: {
      // MUST match your API Identifier exactly:
      audience: 'https://calendar.yourgoalplanner.com/api',
      // Send users back to your app after login
      redirect_uri: window.location.origin
    }
  };

  let auth0Client;

  async function initAuth() {
    auth0Client = await auth0.createAuth0Client(auth0Config);

    // Handle the redirect back from Universal Login
    if (location.search.includes('code=') && location.search.includes('state=')) {
      const { appState } = await auth0Client.handleRedirectCallback();
      // Optional: restore original path
      const target = appState?.target || '/';
      window.history.replaceState({}, document.title, target);
    }

    // Update UI
    const isAuthed = await auth0Client.isAuthenticated();
    document.body.dataset.authed = isAuthed ? 'true' : 'false';
  }

  // --- Login / Logout buttons (hook these to your UI) ---
  async function login() {
    await auth0Client.loginWithRedirect({
      // Keep where the user was
      appState: { target: location.pathname + location.search + location.hash }
      // You can also add scope here if you need more than the defaults
      // authorizationParams: { scope: 'openid profile email read:things' }
    });
  }

  async function logout() {
    await auth0Client.logout({
      logoutParams: {
        // Must be listed under "Allowed Logout URLs"
        returnTo: window.location.origin
      }
    });
  }

  // --- Get an Access Token for your API (includes your custom email claim) ---
  async function getApiToken() {
    // audience comes from auth0Config.authorizationParams by default
    return await auth0Client.getTokenSilently();
    // If you prefer to be explicit:
    // return await auth0Client.getTokenSilently({ authorizationParams: { audience: 'https://calendar.yourgoalplanner.com/api' } });
  }

  // --- Example: call your API with the token ---
  async function callProtectedApi() {
    const token = await getApiToken();
    const res = await fetch('https://calendar.yourgoalplanner.com/api/whatever', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('API response:', data);
  }

  // Expose helpers (wire these to buttons)
  window.auth = { login, logout, callProtectedApi };

  // Kick off
  initAuth();
</script>
