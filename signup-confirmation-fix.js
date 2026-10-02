// Cheese Louise auth patch — force signup confirmation links back to the actual GitHub Pages app.
// This prevents confirmations from landing on https://moldavite333.github.io/ (404)
// instead of https://moldavite333.github.io/Cheese-Louise/.

const CL_SIGNUP_REDIRECT_URL = 'https://moldavite333.github.io/Cheese-Louise/';
let clPendingConfirmationEmail = '';

function confirmationNeededScreen(email, note='Check your email and tap the newest confirmation link.'){
  clPendingConfirmationEmail = email || clPendingConfirmationEmail;
  shell(`<div class="app-shell" style="max-width:520px;margin:0 auto;padding-top:8vh">
    <section class="section">
      <div class="card card-pad">
        <div class="brand-row" style="margin-bottom:18px">
          <div class="brand"><div class="brand-mark">CL</div><div>Cheese Louise HQ</div></div>
        </div>
        <div class="page-title">Confirm your email</div>
        <div class="subtle">${esc(note)}</div>
        <div style="display:grid;gap:10px;margin-top:18px">
          <div class="subtle">${esc(clPendingConfirmationEmail)}</div>
          <button class="primary" type="button" onclick="resendSignupConfirmation()">Resend confirmation email</button>
          <button class="secondary" type="button" onclick="authScreen('After confirming your email, sign in here.')">Back to sign in</button>
        </div>
      </div>
    </section>
  </div>`);
}

window.signUp = async function(){
  const display_name=document.getElementById('displayName')?.value.trim() || 'Cheese Louise User';
  const email=document.getElementById('email')?.value.trim();
  const password=document.getElementById('password')?.value || '';
  if(!email||password.length<6) return authScreen('Use a real email and a password at least 6 characters long.');

  const {data,error}=await db.auth.signUp({
    email,
    password,
    options:{
      data:{display_name},
      emailRedirectTo:CL_SIGNUP_REDIRECT_URL
    }
  });

  if(error){
    if(error.code==='over_email_send_rate_limit' || /rate limit|security purposes/i.test(error.message||'')){
      return confirmationNeededScreen(email,'Too many confirmation emails were requested too quickly. Wait a minute, then resend one fresh confirmation email.');
    }
    return authScreen(error.message);
  }

  if(!data.session){
    return confirmationNeededScreen(email,'Account created. Confirm your email before signing in. Use only the newest confirmation email.');
  }
  await boot();
};

window.resendSignupConfirmation = async function(){
  const email = clPendingConfirmationEmail || document.getElementById('email')?.value.trim();
  if(!email) return authScreen('Enter your email first.');

  const button = document.querySelector('button[onclick="resendSignupConfirmation()"]');
  if(button){ button.disabled=true; button.textContent='Sending…'; }

  const {error}=await db.auth.resend({
    type:'signup',
    email,
    options:{emailRedirectTo:CL_SIGNUP_REDIRECT_URL}
  });

  if(error){
    return confirmationNeededScreen(email,
      (error.code==='over_email_send_rate_limit' || /rate limit|security purposes/i.test(error.message||''))
        ? 'Supabase is temporarily rate-limiting confirmation email requests. Wait about a minute, then tap Resend once.'
        : error.message
    );
  }

  confirmationNeededScreen(email,'Fresh confirmation email sent. Open the newest one only. It will return you directly to Cheese Louise HQ.');
};

// Give unconfirmed accounts a useful screen instead of a generic login error.
window.signInWithRecoveryCleanup = async function(){
  const email=document.getElementById('email')?.value.trim();
  const password=document.getElementById('password')?.value || '';
  if(!email||!password) return authScreen('Enter your email and password.');

  const {error}=await db.auth.signInWithPassword({email,password});
  if(error){
    if(error.code==='email_not_confirmed' || /email not confirmed/i.test(error.message||'')){
      return confirmationNeededScreen(email,'Your account exists, but the email still needs to be confirmed.');
    }
    return authScreen(error.message);
  }

  localStorage.removeItem(RECOVERY_PENDING_KEY);
  recoveryMode = false;
  window.__CL_RECOVERY_BOOT = false;
  await boot();
};

window.confirmationNeededScreen = confirmationNeededScreen;
