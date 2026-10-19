// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-05 Splash · phone (P4, phone)
import { Text, View, StyleSheet } from 'react-native';
import { useSplash } from '@/lodestar/live';
import { Frame, Grad, Icon, Scroll, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

// No timed hop here: useSplash() opens the role's first screen when signed in, else the sign-in screen.
const nav: ScreenNav = {"links":{}};

export default function ScreenDr05Splash() {
  useSplash('dr-06-sign-in');
  return (
    <Frame bg="#0a0f1e" nav={nav} style={s.v0}>
      <View style={s.v26}>
        <Grad g={G0} />
        <View style={s.v11}>
          <View style={s.v1} />
          <View style={s.v2} />
          <View style={s.v3} />
          <View style={s.v4} />
          <View style={s.v5} />
          <View style={s.v6} />
          <View style={s.v7} />
          <View style={s.v8} />
          <View style={s.v9} />
          <View style={s.v10} />
        </View>
        <Icon xml={X0} width={374} height={260} style={s.v12} />
        <Scroll style={s.v18} contentStyle={s.v19}>
          <View style={s.v14}>
            <Icon xml={X1} width={64} height={64} style={s.v13} />
          </View>
          <View>
            <Text style={s.t16}>{"Lodestar "}<Text style={s.t15}>{"Run"}</Text></Text>
          </View>
          <View>
            <Text style={s.t17}>{"Every order, one thread."}</Text>
          </View>
        </Scroll>
        <View style={s.v25}>
          <View style={s.v22}>
            <View style={s.v21}>
              <Grad g={G1} style={s.v20} />
            </View>
          </View>
          <View>
            <Text style={s.t23}>{"Checking for today's run"}</Text>
          </View>
          <View>
            <Text style={s.t24}>{"Waypoint Lodestar · for Waypoint Group"}</Text>
          </View>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 374 260\" preserveAspectRatio=\"none\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"374\" height=\"260\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0 150 C 50 110, 90 120, 130 92 C 170 64, 200 96, 240 80 C 280 64, 320 70, 374 40 L374 260 L0 260 Z\" fill=\"#26327a\" opacity=\"0.7\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M0 200 C 60 160, 110 176, 160 150 C 210 124, 250 160, 300 140 C 330 128, 352 132, 374 120 L374 260 L0 260 Z\" fill=\"#0a0f2e\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg width=\"64\" height=\"64\" viewBox=\"0 0 32 32\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":180,"at":null,"repeat":false,"stops":[{"c":"#050919","p":0},{"c":"#0c1238","p":0.45},{"c":"#1a2463","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":90,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"position":"absolute","top":90,"right":331,"bottom":507,"left":40,"width":3,"height":3,"backgroundColor":"#ffffff","borderRadius":1.5,"opacity":0.7},
  v2: {"position":"absolute","top":150,"right":275,"bottom":447,"left":96,"width":3,"height":3,"backgroundColor":"#ffffff","borderRadius":1.5,"opacity":0.4},
  v3: {"position":"absolute","top":80,"right":71,"bottom":517,"left":300,"width":3,"height":3,"backgroundColor":"#ffffff","borderRadius":1.5,"opacity":0.6},
  v4: {"position":"absolute","top":190,"right":41,"bottom":407,"left":330,"width":3,"height":3,"backgroundColor":"#ffffff","borderRadius":1.5,"opacity":0.35},
  v5: {"position":"absolute","top":120,"right":151,"bottom":477,"left":220,"width":3,"height":3,"backgroundColor":"#ffffff","borderRadius":1.5,"opacity":0.5},
  v6: {"position":"absolute","top":260,"right":311,"bottom":337,"left":60,"width":3,"height":3,"backgroundColor":"#ffffff","borderRadius":1.5,"opacity":0.35},
  v7: {"position":"absolute","top":60,"right":221,"bottom":537,"left":150,"width":3,"height":3,"backgroundColor":"#ffffff","borderRadius":1.5,"opacity":0.45},
  v8: {"position":"absolute","top":300,"right":91,"bottom":297,"left":280,"width":3,"height":3,"backgroundColor":"#ffffff","borderRadius":1.5,"opacity":0.4},
  v9: {"position":"absolute","top":380,"right":347,"bottom":217,"left":24,"width":3,"height":3,"backgroundColor":"#ffffff","borderRadius":1.5,"opacity":0.3},
  v10: {"position":"absolute","top":420,"right":21,"bottom":177,"left":350,"width":3,"height":3,"backgroundColor":"#ffffff","borderRadius":1.5,"opacity":0.3},
  v11: {"flexShrink":1,"position":"absolute","top":0,"right":0,"bottom":228,"left":0,"width":374,"height":600},
  v12: {"flexShrink":1,"position":"absolute","top":568,"bottom":0,"left":0,"right":0,"overflow":"hidden"},
  v13: {"flexShrink":1,"overflow":"hidden"},
  v14: {"flexDirection":"row","justifyContent":"center","alignItems":"center","marginBottom":10,"width":116,"height":116,"backgroundColor":"rgba(245, 184, 61, 0.08)","borderRadius":36,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 0px 0px 1px, rgba(245, 184, 61, 0.3) 0px 0px 90px 0px"},
  t15: {"color":"#ffcb5c"},
  t16: {"color":"#ffffff","fontSize":40,"lineHeight":42,"letterSpacing":-1.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t17: {"color":"#b9c0e6","fontSize":16,"lineHeight":24,"fontFamily":"Inter_500Medium"},
  v18: {"flexGrow":1,"flexBasis":"0%"},
  v19: {"flexDirection":"column","justifyContent":"center","alignItems":"center","rowGap":16,"columnGap":16,"paddingRight":28,"paddingBottom":120,"paddingLeft":28},
  v20: {"borderRadius":3},
  v21: {"flexShrink":1,"width":"55%","borderRadius":3},
  v22: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"width":132,"height":6,"backgroundColor":"rgba(255, 255, 255, 0.12)","borderRadius":3,"overflow":"hidden"},
  t23: {"color":"#c9cfe8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t24: {"color":"#7f89b8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v25: {"flexDirection":"column","alignItems":"center","rowGap":12,"columnGap":12,"paddingBottom":22},
  v26: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
}));
