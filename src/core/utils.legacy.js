  const fmtDate = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const dateFromString = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d,12); };
  const today = () => fmtDate(new Date());
  const safe = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const safeLogo = url => { try { const u = new URL(url); return u.protocol==='https:' && (u.hostname.endsWith('.espncdn.com')||u.hostname==='espncdn.com') ? u.href : ''; } catch { return ''; } };

