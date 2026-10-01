// Small auth UX improvements layered on top of app.js.
// Keeps the core v1.2 logic untouched while making login easier on mobile.

const originalAuthScreen = authScreen;

authScreen = function(note=''){
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
            <button id="passwordToggle" class="secondary" type="button" onclick="togglePassword()" aria-label="Show password">Show</button>
          </div>
          <button class="primary" onclick="signIn()">Sign in</button>
          <button class="secondary" onclick="signUp()">Create account</button>
        </div>
        ${note ? message(note) : ''}
      </div>
    </section>
  </div>`);
};

window.togglePassword = function(){
  const input = document.getElementById('password');
  const button = document.getElementById('passwordToggle');
  if(!input || !button) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  button.textContent = showing ? 'Show' : 'Hide';
  button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  input.focus();
};

// app.js may have already drawn the original auth screen before this file loaded.
// Redraw it once with the improved controls when no session exists yet.
if(!session){
  authScreen();
}
