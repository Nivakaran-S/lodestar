import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';

import { FACES, FLOWS, LIVE } from '@/screens/registry';
import { goHome } from '@/auth/use-sign-in';
import { useOutbox, useSession } from '@/model/hooks';
import { session } from '@/model/platform';
import { runAvailable } from '@/lib/config';

const live = new Set(LIVE);
// Only screens that run on real data are opened from here; the design-only mocks stay out of navigation.
// Lodestar Run is an Android app: a web build without it (lib/config.ts) leaves the driver's face and flows out.
const shown = (key: string) => runAvailable() || !key.startsWith('dr-');
const faces = FACES.filter(f => shown(f.start)).map(f => ({ ...f, screens: f.screens.filter(s => live.has(s.key)) }));
const flows = FLOWS.filter(f => live.has(f.key) && shown(f.key));

// One build carries the four field faces for the demo; each opens at its own splash screen.
const COLOR: Record<string, string> = { store: '#047857', plan: '#3B4CCA', dock: '#6D28D9', run: '#0369A1' };
const open = (key: string) => router.push({ pathname: '/s/[key]', params: { key } });

// Who is signed in on this phone, what is waiting to send, and the way back to their app.
function SessionCard() {
  const s = useSession();
  const { waiting } = useOutbox();
  const { width } = useWindowDimensions();
  if (s.status !== 'signed-in' || !s.claims) {
    return (
      <View style={{ borderRadius: 18, backgroundColor: '#141B2E', borderWidth: 1, borderColor: '#28314A', padding: 16, gap: 4 }}>
        <Text style={{ color: '#F2F4FA', fontFamily: 'Inter_700Bold', fontSize: 15 }}>{s.status === 'restoring' ? 'Checking this phone…' : 'Not signed in'}</Text>
        <Text style={{ color: '#7F89A3', fontFamily: 'Inter_500Medium', fontSize: 13 }}>Open your app below and sign in with your Waypoint account.{waiting.length ? ` ${waiting.length} saved on this phone.` : ''}</Text>
      </View>
    );
  }
  const claims = s.claims;
  return (
    <View testID="session-card" style={{ borderRadius: 18, backgroundColor: '#141B2E', borderWidth: 1, borderColor: '#F5B83D55', padding: 16, gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: '#F2F4FA', fontFamily: 'Inter_700Bold', fontSize: 16 }}>{claims.name ?? claims.username}</Text>
        <Text style={{ color: '#7F89A3', fontFamily: 'Inter_500Medium', fontSize: 13 }}>
          {[claims.roles.join(', '), claims.vehicleId, claims.outletId, claims.depots.join(' · ')].filter(Boolean).join(' · ')}
          {s.offline ? ' · offline' : ''}
          {waiting.length ? ` · ${waiting.length} to send` : ''}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable testID="open-my-app" onPress={() => goHome(claims, width)} style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: pressed ? '#d9a032' : '#F5B83D' })}>
          <Text style={{ color: '#111522', fontFamily: 'Inter_700Bold', fontSize: 14 }}>Open my app</Text>
        </Pressable>
        <Pressable testID="sign-out" onPress={() => void session.signOut()} style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: pressed ? '#232C50' : '#1A2340' })}>
          <Text style={{ color: '#F2F4FA', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Home() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B1020' }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ gap: 4, marginBottom: 6 }}>
          <Text style={{ color: '#8F98AA', fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>Waypoint Group</Text>
          <Text style={{ color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 32, letterSpacing: -0.9 }}>Waypoint Lodestar</Text>
          <Text style={{ color: '#B5BDD1', fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 }}>Every order, one thread. Choose the app to open.</Text>
        </View>

        <SessionCard />

        {faces.map(face => (
          <View key={face.title} style={{ borderRadius: 18, backgroundColor: '#141B2E', borderWidth: 1, borderColor: '#28314A', overflow: 'hidden' }}>
            <Pressable onPress={() => open(face.start)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, opacity: pressed ? 0.8 : 1 })}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: COLOR[face.app] ?? '#334155' }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: '#F2F4FA', fontFamily: 'Inter_700Bold', fontSize: 17 }}>{face.title}</Text>
                <Text style={{ color: '#7F89A3', fontFamily: 'Inter_500Medium', fontSize: 13 }}>{face.screens.length} screens · {face.device}</Text>
              </View>
              <Text style={{ color: '#F5B83D', fontFamily: 'Inter_700Bold', fontSize: 14 }}>Open</Text>
            </Pressable>
            <Pressable onPress={() => setExpanded(expanded === face.title ? null : face.title)} style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              <Text style={{ color: '#8C98F2', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{expanded === face.title ? 'Hide screens' : 'All screens'}</Text>
            </Pressable>
            {expanded === face.title && face.screens.map(s => (
              <Pressable key={s.key} onPress={() => open(s.key)} style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#1F2740', backgroundColor: pressed ? '#1A2340' : 'transparent' })}>
                <Text style={{ color: '#7F89A3', fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, width: 64 }}>{s.id}</Text>
                <Text style={{ color: '#DCE4F5', fontFamily: 'Inter_500Medium', fontSize: 14, flex: 1 }}>{s.name.replace(/^\S+\s/, '')}</Text>
              </Pressable>
            ))}
          </View>
        ))}

        <Text style={{ color: '#8F98AA', fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 10 }}>Demo flows</Text>
        {flows.map(f => (
          <Pressable key={f.name} onPress={() => open(f.key)} style={({ pressed }) => ({ padding: 14, borderRadius: 14, backgroundColor: pressed ? '#232C50' : '#1A2340' })}>
            <Text style={{ color: '#F2F4FA', fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>{f.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
