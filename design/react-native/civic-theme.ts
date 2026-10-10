import { StyleSheet } from 'react-native';

// Migration starter; use with SafeAreaProvider and dynamic type enabled.
export const civic = {
  color: {
    canvas:'#F8FAFC', surface:'#FFFFFF', primary:'#0F2942', hover:'#1B3A57', pressed:'#091D30',
    text:'#0F172A', secondary:'#334155', muted:'#475569', decorative:'#94A3B8',
    border:'#E2E8F0', chipBorder:'#CBD5E1', controlBorder:'#64748B', well:'#F1F5F9',
    verifiedAccent:'#059669', verifiedText:'#047857', verifiedBg:'#ECFDF5',
    pendingAccent:'#D97706', pendingText:'#92400E', pendingBg:'#FFFBEB',
    error:'#DC2626', pass:'#0F2942', passText:'#FFFFFF', passMuted:'#CBD5E1',
    passVerifiedBg:'#064E3B', passVerifiedText:'#A7F3D0', tier:'#E2E8F0',
  },
  radius:{card:12,control:8,tag:4,chip:999},
  spacing:{micro:4,label:8,card:12,gutter:16,section:24,major:32},
  size:{touch:44,buttonVisual:40,iconWell:36,portrait:48,dateWidth:44,dateHeight:50,menuRow:48,nav:56},
  type:{page:22,section:16,hero:14,label:13,body:15,meta:11,caption:10,calendarMonth:9},
} as const;
export const civicStyles=StyleSheet.create({
  page:{flex:1,backgroundColor:civic.color.canvas},
  content:{paddingHorizontal:16,paddingTop:16,paddingBottom:24},
  card:{backgroundColor:civic.color.surface,borderColor:civic.color.border,borderWidth:1,borderRadius:12,padding:12,shadowColor:'#0F172A',shadowOffset:{width:0,height:1},shadowOpacity:.04,shadowRadius:2,elevation:1},
  buttonTarget:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',paddingHorizontal:16,borderRadius:8,backgroundColor:civic.color.primary},
  buttonLabel:{color:'#FFFFFF',fontSize:13,lineHeight:20,fontWeight:'600'},
  name:{fontSize:16,lineHeight:24,fontWeight:'700',color:'#FFFFFF',flexShrink:1},
  meta:{fontSize:11,lineHeight:17,color:civic.color.muted},
  tamil:{fontFamily:'NotoSansTamil',letterSpacing:0},
  iconWell:{width:36,height:36,backgroundColor:civic.color.well,borderRadius:8,alignItems:'center',justifyContent:'center'},
  row:{minHeight:48,paddingHorizontal:12,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderBottomColor:civic.color.border},
  verified:{backgroundColor:civic.color.verifiedBg,borderRadius:4,paddingHorizontal:8,paddingVertical:4},
  verifiedLabel:{color:civic.color.verifiedText,fontSize:11,lineHeight:17,fontWeight:'600'},
});
