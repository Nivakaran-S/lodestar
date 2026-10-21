'use client';
// ADM-01 Sign in · desktop, live. Markup and classes from the generated design (frontend/screens/adm-01-sign-in.tsx).
// "Continue with Waypoint single sign-on" (L284) keeps Keycloak's redirect sign-in. "Or use your work email": the
// email and password post straight to the token endpoint (lib/auth/direct.ts) and the realm's direct-grant flow
// asks for the second step the design announces ("There is no way to skip it"): the authenticator code, or a
// code sent to the admin's work phone. That step replaces the card in place (ADM has no screen of its own for it;
// it uses DSP-07's markup, components/live/TwoStep.tsx). Additions to the drawn card: the password field and a
// "Continue" button for the email path, in the card's own dx-field / dx-bigbtn--sec look.
import { useState } from 'react';
import { Ic } from '@/components/live/icons';
import Btn from '@/components/live/Btn';
import { needsCode, pendingPassword, type PendingPassword } from '@/lib/auth/direct';
import { bareInput, PasswordInput, remembered, SignInMessage, useDirectSignIn } from '@/components/live/DirectSignIn';
import { TwoStepCard } from '@/components/live/TwoStep';

export default function LiveAdm01SignIn() {
  const flow = useDirectSignIn('admin');
  const [email, setEmail] = useState(() => remembered.get('admin.email') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPassword | null>(null);


  const go = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError(!email.trim() ? 'Enter your work email.' : 'Enter your password.');
      return;
    }
    const r = await flow.submit({ username: email.trim(), password });
    if (r.ok) return;
    if (needsCode(r)) {
      const p = { username: email.trim(), password, step: r, at: Date.now(), returnTo: flow.returnTo };
      pendingPassword.set(p);
      setPending(p);
      setPassword('');
      return;
    }
    setError(r.description);
  };

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="ADM-01 Sign in · desktop">
      <div className="dx-auth">
        <div className="dx-auth__brand adm-brand">
          <div className="dx-auth__logo">
            <svg width="36" height="36" viewBox="0 0 32 32" style={{"flexShrink": "0"}}>
              <rect width="32" height="32" rx="8" fill="#334155" />
              <g transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </g>
            </svg>
            {"Lodestar Admin"}
          </div>
          <div className="dx-auth__tag">{"Keep the keys,"}<br /><b>{"keep the thread."}</b></div>
          <div className="dx-auth__sub">
            {"People, devices and master data behind Lodestar Plan, Dock, Run and Store. Changes here reach every face."}
          </div>
          <div style={{"display": "flex", "justifyContent": "center"}}>
            <svg width="508" height="300" viewBox="0 0 508 300" style={{"flexShrink": "0"}}>
              <circle cx="254" cy="150" r="118" fill="none" stroke="#94A3B8" strokeOpacity=".22" strokeWidth="1.5" strokeDasharray="2 8" />
              {" "}
              <circle cx="254" cy="150" r="70" fill="#F5B83D" opacity=".07" />
              {" "}
              <path d="M254 150 L120 64 M254 150 L388 64 M254 150 L120 236 M254 150 L388 236" stroke="#94A3B8" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="1 7" strokeLinecap="round" />
              {" "}
              <g transform="translate(222 118) scale(2)">
                <rect width="32" height="32" rx="8" fill="#334155" stroke="#64748B" strokeWidth=".6" />
                <g transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </g>
              </g>
              {" "}
              <g transform="translate(96 40) scale(1.5)">
                <rect width="32" height="32" rx="8" fill="#3B4CCA" />
                <g transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </g>
              </g>
              {" "}
              <g transform="translate(364 40) scale(1.5)">
                <rect width="32" height="32" rx="8" fill="#141B4D" stroke="#475569" strokeWidth=".6" />
                <g transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <path d="M3.3 7 12 12l8.7-5M12 22V12" />
                </g>
              </g>
              {" "}
              <g transform="translate(96 212) scale(1.5)">
                <rect width="32" height="32" rx="8" fill="#0369A1" />
                <g transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 11 19-9-9 19-2-8-8-2z" />
                </g>
              </g>
              {" "}
              <g transform="translate(364 212) scale(1.5)">
                <rect width="32" height="32" rx="8" fill="#047857" />
                <g transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l1.5-5h15L21 9" />
                  <path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
                  <path d="M5 13v8h14v-8M10 21v-5h4v5" />
                </g>
              </g>
              <text x="120" y="30" textAnchor="middle" fontFamily="Inter" fontSize="13" fontWeight="700" fill="#CBD5E1">{"Plan"}</text>
              <text x="388" y="30" textAnchor="middle" fontFamily="Inter" fontSize="13" fontWeight="700" fill="#CBD5E1">{"Dock"}</text>
              <text x="120" y="290" textAnchor="middle" fontFamily="Inter" fontSize="13" fontWeight="700" fill="#CBD5E1">{"Run"}</text>
              <text x="388" y="290" textAnchor="middle" fontFamily="Inter" fontSize="13" fontWeight="700" fill="#CBD5E1">{"Store"}</text>
            </svg>
          </div>
          <div className="dx-auth__foot">
            <span><Ic n="depot" />{"Waypoint Group HQ, Peliyagoda"}</span>
            <span><Ic n="lock" />{"Every action signed and logged"}</span>
          </div>
        </div>
        <div className="dx-auth__main">
          {pending ? (
            <TwoStepCard pending={pending} flow={flow} rememberKey="admin.email" onRestart={() => { pendingPassword.clear(); setPending(null); }} />
          ) : (
          <form className="dx-auth__card" onSubmit={e => { e.preventDefault(); void go(); }} noValidate>
            <div className="vstack" style={{"gap": "8px"}}>
              <span className="d-eyebrow">{"Waypoint Group · Lodestar Admin"}</span>
              <div className="dx-h1xl">{"Sign in to the admin console"}</div>
              <span className="dx-t14">
                {"For operations systems admins only. Dispatchers, loaders, drivers and store staff sign in to their own app."}
              </span>
            </div>
            <Btn as="div" className="dx-bigbtn" lk="L284" testId="sso" onClick={flow.sso}>
              <Ic n="key" />{"Continue with Waypoint single sign-on"}
            </Btn>
            <div className="dx-or"><i />{"or use your work email"}<i /></div>
            <div className="dx-field">
              <label className="dx-label" htmlFor="adm01-email">{"Work email"}</label>
              <div className="dx-input dx-input--focus">
                <Ic n="mail" />
                <input id="adm01-email" data-testid="email-input" type="email" autoComplete="username" placeholder="name@waypoint.lk"
                  style={bareInput} value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="dx-field">
              <label className="dx-label" htmlFor="adm01-password">{"Password"}</label>
              <div className="dx-input">
                <Ic n="lock" />
                <PasswordInput id="adm01-password" value={password} onChange={setPassword} />
              </div>
            </div>
            <SignInMessage text={error} />
            <Btn as="div" className="dx-bigbtn dx-bigbtn--sec" testId="sign-in" busy={flow.busy} onClick={() => void go()}>
              {flow.busy ? 'Checking…' : 'Continue'}<Ic n="arrow-right" />
            </Btn>
            <button type="submit" hidden aria-hidden tabIndex={-1} />
            <div className="dx-inset dx-inset--brand" style={{"flexDirection": "row", "alignItems": "flex-start", "gap": "12px", "padding": "14px 16px"}}>
              <svg className="ic" viewBox="0 0 24 24" style={{"width": "20px", "height": "20px", "color": "var(--brand-600)", "flexShrink": "0", "marginTop": "1px"}}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span className="dx-t14" style={{"fontSize": "13.5px"}}>
                <b>{"2-step verification is required."}</b>
                {" Next you confirm with your security key or the authenticator code on your work phone. There is no way to skip it."}
              </span>
            </div>
            <div className="between dx-t13"><span>{"Lost your security key? Call the Peliyagoda IT desk."}</span></div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
