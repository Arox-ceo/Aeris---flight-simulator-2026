// Change these two values to customize the reward.
const REDEEM_CODE = 'The.End';
const REWARD_IMAGE = './ajitama.png';

const style = document.createElement('style');
style.textContent = `
.redeem-button{width:auto;padding:0 12px;font-size:11px}
#redeem-dialog{width:min(440px,92vw)}
#redeem-dialog form{display:grid;gap:16px}
#redeem-code{width:100%;padding:14px;border:1px solid #71939c;border-radius:8px;background:#071a26;color:white;font:inherit}
#redeem-message{min-height:24px;color:#ffd18b;font-size:13px}
#redeem-reward{position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0!important;border-radius:0!important;background:#000!important;overflow:hidden}
#redeem-reward img{display:block;width:100%;height:100%;object-fit:contain}
#redeem-reward .reward-close{position:absolute;right:20px;top:20px;padding:12px 18px;border-radius:8px;background:#071a26e8;color:#fff;font:600 14px sans-serif;z-index:1}
`;
document.head.append(style);
const menu = document.createElement('dialog');
menu.id = 'redeem-dialog';
menu.innerHTML = '<button class="close" aria-label="Close redeem menu">×</button><span class="overline">BONUS CONTENT</span><h2>Redeem a code</h2><form><label for="redeem-code">Your code</label><input id="redeem-code" autocomplete="off" spellcheck="false" maxlength="64" required><button class="primary" type="submit">Redeem</button><div id="redeem-message" role="status" aria-live="polite"></div></form>';
const reward = document.createElement('dialog');
reward.id = 'redeem-reward';
reward.setAttribute('aria-label', 'Ajitama reward');
reward.innerHTML = '<img alt="Ajitama redeem reward"><button class="reward-close" aria-label="Close reward">Close · Esc</button>';
document.body.append(menu, reward);
const button = document.createElement('button');
button.className = 'icon-btn redeem-button';
button.textContent = 'Redeem';
button.setAttribute('aria-label', 'Redeem a code');
document.querySelector('header nav').prepend(button);
const input = menu.querySelector('input');
const message = menu.querySelector('[role="status"]');
const submit = menu.querySelector('[type="submit"]');
let request = 0;
button.onclick = () => { message.textContent = ''; input.value = ''; menu.showModal(); input.focus(); };
menu.querySelector('.close').onclick = () => menu.close();
menu.addEventListener('close', () => { request++; submit.disabled = false; });
reward.querySelector('button').onclick = () => reward.close();
// Native modal dialogs pause the existing simulation and Escape dismisses them.
// Stop flight shortcuts while these dialogs are open, retaining native Escape/Tab.
document.addEventListener('keydown', e => {
  if (menu.open || reward.open) e.stopImmediatePropagation();
}, true);
menu.querySelector('form').addEventListener('submit', async e => {
  e.preventDefault();
  if (input.value.trim().toUpperCase() !== REDEEM_CODE) {
    message.textContent = 'Invalid code. Please try again.';
    return;
  }
  const token = ++request;
  submit.disabled = true;
  message.textContent = 'Loading your reward…';
  const image = reward.querySelector('img');
  try {
    image.src = REWARD_IMAGE;
    await image.decode();
    if (token !== request || !menu.open) return;
    menu.close();
    reward.showModal();
    reward.querySelector('button').focus();
  } catch {
    if (token === request && menu.open) message.textContent = 'Reward image unavailable. Add ajitama.png beside index.html, then try again.';
  } finally {
    if (token === request) submit.disabled = false;
  }
});
