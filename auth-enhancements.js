// Auth UX improvements layered on top of app.js.
// Keeps the core v1.2 logic untouched while making login and recovery easier on mobile.

const AUTH_REDIRECT_URL = 'https://moldavite333.github.io/Cheese-Louise/';
const RECOVERY_PENDING_KEY = 'cheeseLouiseRecoveryPending';
let recoveryMode = !!window.__CL_RECOVERY_BOOT;

function authScreen(note=''){
  const previousName = document.getElementById('displayName')?.value || '';
  const previousEmail = document.getElementById('email')?.value || '';

  shell(`<div class="app-shell" style="max-width:520px;margin:0 auto;padding-top:8vh">
    <section class="section">
      <div class="card card-pad">
        <div class="brand-row" style="margin-bottom:18px">
          <div class="brand"><div class="brand-mark">CL</div><div>Cheese Louise HQ</div></div>
        </div>
        <div class="page-title">Sign in</div>
        <div class="subtle">Nick and Jenny each use their own login. Shared stuff stays shared.</div>
        <div style="display:grid;gap:10px;margin-top:18px">
          <input id="displayName" class="search" placeholder="Your name (needed for first signup)" value="${esc(previousName)}" />
          <input id="email" class="search" type="email" placeholder="Email" value="${esc(previousEmail)}" autocomplete="email" />
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">
            <input id="password" class="search" type="password" placeholder="Password" autocomplete="current-password" style="min-width:0" />
            <button id="passwordToggle" class="secondary" type="button" onclick="togglePassword('password','passwordToggle')" aria-label="Show password">Show</button>
          </div>
          <button class="primary" onclick="signInWithRecoveryCleanup()">Sign in</button>
          <button class="secondary" onclick="signUp()">Create account</button>
          <button class="secondary" type="button" onclick="requestPasswordReset()" style="background:transparent;border-color:transparent">Forgot password?</button>
        </div>
        ${note ? message(note) : ''}
      </div>
    </section>
  </div>`);
}

function recoveryScreen(note='Choose a new password for your Cheese Louise account.'){
  shell(`<div class="app-shell" style="max-width:520px;margin:0 auto;padding-top:8vh">
    <section class="section">
      <div class="card card-pad">
        <div class="brand-row" style="margin-bottom:18px">
          <div class="brand"><div class="brand-mark">CL</div><div>Cheese Louise HQ</div></div>
        </div>
        <div class="page-title">Reset password</div>
        <div class="subtle">${esc(note)}</div>
        <div style="display:grid;gap:10px;margin-top:18px">
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">
            <input id="newPassword" class="search" type="password" placeholder="New password" autocomplete="new-password" style="min-width:0" />
            <button id="newPasswordToggle" class="secondary" type="button" onclick="togglePassword('newPassword','newPasswordToggle')">Show</button>
          </div>
          <input id="confirmPassword" class="search" type="password" placeholder="Confirm new password" autocomplete="new-password" />
          <button class="primary" onclick="finishPasswordReset()">Save new password</button>
          <button class="secondary" type="button" onclick="cancelPasswordReset()">Cancel</button>
        </div>
      </div>
    </section>
  </div>`);
}

window.togglePassword = function(inputId='password', buttonId='passwordToggle'){
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  if(!input || !button) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  button.textContent = showing ? 'Show' : 'Hide';
  button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  input.focus();
};

window.signInWithRecoveryCleanup = async function(){
  const email=document.getElementById('email')?.value.trim();
  const password=document.getElementById('password')?.value || '';
  if(!email||!password) return authScreen('Enter your email and password.');
  const {error}=await db.auth.signInWithPassword({email,password});
  if(error) return authScreen(error.message);
  localStorage.removeItem(RECOVERY_PENDING_KEY);
  recoveryMode = false;
  window.__CL_RECOVERY_BOOT = false;
  await boot();
};

window.requestPasswordReset = async function(){
  const email = document.getElementById('email')?.value.trim();
  if(!email) return authScreen('Enter your email address first, then tap Forgot password.');

  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: AUTH_REDIRECT_URL });
  if(error) return authScreen(error.message);

  localStorage.setItem(RECOVERY_PENDING_KEY, '1');
  authScreen('Password reset email sent. Open the newest email from Supabase and tap the reset link.');
};

window.finishPasswordReset = async function(){
  const password = document.getElementById('newPassword')?.value || '';
  const confirm = document.getElementById('confirmPassword')?.value || '';

  if(password.length < 6) return recoveryScreen('Use a password at least 6 characters long.');
  if(password !== confirm) return recoveryScreen('Those passwords do not match. Try again.');

  const { data: sessionData } = await db.auth.getSession();
  if(!sessionData?.session) return recoveryScreen('The reset link is no longer active. Request a new password reset email.');

  const { error } = await db.auth.updateUser({ password });
  if(error) return recoveryScreen(error.message);

  localStorage.removeItem(RECOVERY_PENDING_KEY);
  recoveryMode = false;
  window.__CL_RECOVERY_BOOT = false;
  await db.auth.signOut();
  session = null;
  history.replaceState({}, document.title, AUTH_REDIRECT_URL);
  authScreen('Password updated. Sign in with your new password.');
};

window.cancelPasswordReset = async function(){
  localStorage.removeItem(RECOVERY_PENDING_KEY);
  recoveryMode = false;
  window.__CL_RECOVERY_BOOT = false;
  await db.auth.signOut();
  session = null;
  history.replaceState({}, document.title, AUTH_REDIRECT_URL);
  authScreen('Password reset cancelled.');
};

// Protect recovery mode from app.js's normal authenticated rendering.
// app.js begins booting before this helper loads; these wrappers ensure that if
// its async boot finishes later, it still cannot replace the reset form with
// workspace onboarding or the main app.
const originalOnboardingScreen = onboardingScreen;
const originalRender = render;

onboardingScreen = function(note=''){
  if(recoveryMode || window.__CL_RECOVERY_BOOT){
    recoveryMode = true;
    return recoveryScreen(note || 'Reset link verified. Now choose your new password.');
  }
  return originalOnboardingScreen(note);
};

render = function(){
  if(recoveryMode || window.__CL_RECOVERY_BOOT){
    recoveryMode = true;
    return recoveryScreen('Reset link verified. Now choose your new password.');
  }
  return originalRender();
};

// Supabase emits PASSWORD_RECOVERY after a valid recovery link creates a temporary session.
db.auth.onAuthStateChange((event,newSession)=>{
  if(event === 'PASSWORD_RECOVERY'){
    localStorage.setItem(RECOVERY_PENDING_KEY, '1');
    recoveryMode = true;
    window.__CL_RECOVERY_BOOT = true;
    session = newSession;
    recoveryScreen();
  }
});

// index.html captures the recovery hash before app.js/Supabase can consume it.
if(window.__CL_RECOVERY_BOOT || window.location.hash.includes('type=recovery')){
  localStorage.setItem(RECOVERY_PENDING_KEY, '1');
  recoveryMode = true;
}

(async function restoreRecoveryScreen(){
  const pending = recoveryMode || localStorage.getItem(RECOVERY_PENDING_KEY) === '1';
  if(!pending){
    if(!session) authScreen();
    return;
  }

  const { data } = await db.auth.getSession();
  if(data?.session){
    recoveryMode = true;
    session = data.session;
    recoveryScreen('Reset link verified. Now choose your new password.');
  }else if(window.__CL_RECOVERY_BOOT){
    // Supabase may still be exchanging the recovery token. Keep the reset UI in
    // place instead of dropping back into normal sign-in while that completes.
    recoveryScreen('Verifying your reset link…');
  }else{
    authScreen('Open the password reset email and tap the newest reset link.');
  }
})();
