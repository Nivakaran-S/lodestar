'use client';
// DSP-06 Sign in · desktop, live. Markup and classes from the generated design (frontend/screens/dsp-06-sign-in.tsx).
// The work email (and its password) post straight to the token endpoint (lib/auth/direct.ts); the realm's
// "lodestar direct grant" flow then asks for the second step, which "Continue" (L144) opens on DSP-07: the
// authenticator-app code, or a code sent to the on-call phone. "Sign in with Waypoint single sign-on" keeps the
// redirect sign-in as the secondary path. The password field is the one addition to the drawn screen: the
// design's step 1 needs it ("Step 2 of 2" follows) and it uses the same dx-field/dx-input look.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Ic } from '@/components/live/icons';
import Btn from '@/components/live/Btn';
import { useDepots } from '@/components/live/depots';
import { needsCode, pendingPassword } from '@/lib/auth/direct';
import { bareInput, PasswordInput, remembered, SignInMessage, useDirectSignIn } from '@/components/live/DirectSignIn';

export const DSP07 = '/plan/dsp-07-2-step-verification';

export default function LiveDsp06SignIn() {
  // Depot names come from the registry once signed in; before sign-in none are shown (never a made-up list).
  const { active: depotList } = useDepots();
  const flow = useDirectSignIn('plan');
  const router = useRouter();
  const [email, setEmail] = useState(() => remembered.get('plan.email') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);


  const go = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError(!email.trim() ? 'Enter your work email.' : 'Enter your password.');
      return;
    }
    const r = await flow.submit({ username: email.trim(), password });
    if (r.ok) return;
    if (needsCode(r)) {
      pendingPassword.set({ username: email.trim(), password, step: r, at: Date.now(), returnTo: flow.returnTo });
      setPassword('');
      router.push(flow.returnTo ? `${DSP07}?returnTo=${encodeURIComponent(flow.returnTo)}` : DSP07);
      return;
    }
    setError(r.description);
  };

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="DSP-06 Sign in · desktop">
      <div className="dx-auth">
        <div className="dx-auth__brand">
          <div className="dx-auth__logo">
            <svg viewBox="0 0 32 32">
              <rect width="32" height="32" rx="8" fill="#3B4CCA" />
              <g transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </g>
            </svg>
            {"Lodestar Plan"}
          </div>
          <div style={{"height": "18px"}} />
          <div className="dx-auth__tag">{"Every order,"}<br /><b>{"one thread."}</b></div>
          <div className="dx-auth__sub">
            {"Review the agent's plans, approve them for docks, drivers and stores, and follow every order to the shelf."}
          </div>
          <div style={{"display": "flex", "borderRadius": "28px", "overflow": "hidden", "background": "rgba(255,255,255,.04)"}}>
            <svg width="508" height="270" viewBox="0 0 508 270" style={{"flexShrink": "0"}}>
              <circle cx="404" cy="66" r="58" fill="#F5B83D" opacity=".10" />
              {" "}
              <circle cx="404" cy="66" r="34" fill="#F5B83D" opacity=".14" />
              {" "}
              <path d="M404 30 L411.5 58.5 L440 66 L411.5 73.5 L404 102 L396.5 73.5 L368 66 L396.5 58.5 Z" fill="#F5B83D" />
              {" "}
              <circle cx="404" cy="66" r="4" fill="#141B4D" />
              {" "}
              <path d="M0 214 C 70 150 130 170 190 132 C 250 94 318 150 372 122 C 424 96 468 112 508 96 L508 270 L0 270 Z" fill="#3B4CCA" opacity=".30" />
              {" "}
              <path d="M0 244 C 90 200 168 222 250 188 C 330 156 412 204 508 172 L508 270 L0 270 Z" fill="#3B4CCA" opacity=".55" />
              {" "}
              <path d="M36 236 C 110 222 150 196 196 186 S 292 160 336 150 S 420 126 466 120" stroke="#F5B83D" strokeWidth="3" fill="none" strokeDasharray="1 10" strokeLinecap="round" />
              {" "}
              <circle cx="36" cy="236" r="9" fill="#FFFFFF" />
              <circle cx="36" cy="236" r="4" fill="#141B4D" />
              {" "}
              <circle cx="196" cy="186" r="7" fill="#FFCB5C" />
              {" "}
              <circle cx="336" cy="150" r="7" fill="#FFCB5C" />
              {" "}
              <circle cx="466" cy="120" r="10" fill="#F5B83D" stroke="#FFFFFF" strokeWidth="3" />
            </svg>
          </div>
          <div className="dx-auth__foot">
            {depotList.map(d => <span key={d.code}><Ic n="depot" />{d.name}</span>)}
            <span><Ic n="lock" />{"Waypoint Group staff only"}</span>
          </div>
        </div>
        <div className="dx-auth__main">
          <form className="dx-auth__card" onSubmit={e => { e.preventDefault(); void go(); }} noValidate>
            <div className="vstack" style={{"gap": "8px"}}>
              <span className="d-eyebrow">{"Waypoint Group · Lodestar Plan"}</span>
              <div className="dx-h1xl">{"Sign in to plan the run"}</div>
              <span className="dx-t14">{"Use your work email. Dispatchers and depot leads only."}</span>
            </div>
            <div className="dx-field">
              <label className="dx-label" htmlFor="dsp06-email">{"Work email"}</label>
              <div className="dx-input dx-input--focus">
                <Ic n="mail" />
                <input id="dsp06-email" data-testid="email-input" type="email" autoComplete="username" placeholder="name@waypoint.lk"
                  style={bareInput} value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="dx-field">
              <label className="dx-label" htmlFor="dsp06-password">{"Password"}</label>
              <div className="dx-input">
                <Ic n="lock" />
                <PasswordInput id="dsp06-password" value={password} onChange={setPassword} />
              </div>
            </div>
            <SignInMessage text={error} />
            <Btn as="div" className="dx-bigbtn" testId="sign-in" lk="L144" busy={flow.busy} onClick={() => void go()}>
              {flow.busy ? 'Checking…' : 'Continue'}<Ic n="arrow-right" />
            </Btn>
            <button type="submit" hidden aria-hidden tabIndex={-1} />
            <div className="dx-or"><i />{"or"}<i /></div>
            <Btn as="div" className="dx-bigbtn dx-bigbtn--sec" testId="sso" onClick={flow.sso}>
              <Ic n="key" />{"Sign in with Waypoint single sign-on"}
            </Btn>
            <div className="between dx-t13"><span data-lk="L145">{"Trouble signing in? Call the Peliyagoda IT desk."}</span></div>
          </form>
        </div>
      </div>
    </div>
  );
}
