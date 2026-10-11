import 'package:flutter/material.dart';

abstract final class CivicTokens {
  static const canvas = Color(0xFFF8FAFC);
  static const surface = Color(0xFFFFFFFF);
  static const navy = Color(0xFF0F2942);
  static const ink = Color(0xFF0F172A);
  static const muted = Color(0xFF475569);
  static const border = Color(0xFFE2E8F0);
  static const controlBorder = Color(0xFF64748B);
  static const well = Color(0xFFF1F5F9);
  static const verifiedAccent = Color(0xFF059669);
  static const verifiedText = Color(0xFF047857);
  static const verifiedBg = Color(0xFFECFDF5);
  static const pendingAccent = Color(0xFFD97706);
  static const pendingText = Color(0xFF92400E);
  static const pendingBg = Color(0xFFFFFBEB);
  static const passMuted = Color(0xFFCBD5E1);
  static const passVerifiedText = Color(0xFFA7F3D0);
  static const passVerifiedBg = Color(0xFF064E3B);
  static const cardRadius = 12.0;
  static const controlRadius = 8.0;
  static const tagRadius = 4.0;
  static const gutter = 16.0;
  static const cardPadding = 12.0;
  static const labelGap = 8.0;
  static const sectionGap = 24.0;
  static const touch = 44.0;
  static const passAspectRatio = 1.586;
  static const microShadow = BoxShadow(
    color: Color.fromRGBO(15, 23, 42, .04),
    offset: Offset(0, 1), blurRadius: 2,
  );
}

ThemeData buildCivicTheme() => ThemeData(
  useMaterial3: true,
  scaffoldBackgroundColor: CivicTokens.canvas,
  colorScheme: const ColorScheme.light(
    primary: CivicTokens.navy, onPrimary: Colors.white,
    secondary: CivicTokens.navy, onSecondary: Colors.white,
    surface: CivicTokens.surface, onSurface: CivicTokens.ink,
    error: Color(0xFFDC2626), onError: Colors.white,
  ),
  // Bundle the font and use script-aware TextStyles for Latin/Tamil.
  fontFamily: 'Inter',
  fontFamilyFallback: const ['Noto Sans Tamil'],
  materialTapTargetSize: MaterialTapTargetSize.padded,
  textTheme: const TextTheme(
    headlineSmall: TextStyle(fontSize:22,height:1.4,fontWeight:FontWeight.w700,color:CivicTokens.ink),
    titleMedium: TextStyle(fontSize:16,height:1.5,fontWeight:FontWeight.w700,color:CivicTokens.ink),
    titleSmall: TextStyle(fontSize:13,height:1.55,fontWeight:FontWeight.w600,color:CivicTokens.ink),
    bodyMedium: TextStyle(fontSize:15,height:1.55,color:CivicTokens.ink),
    bodySmall: TextStyle(fontSize:11,height:1.55,color:CivicTokens.muted),
  ),
  filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(
    minimumSize: const Size(44,44), padding: const EdgeInsets.symmetric(horizontal:16,vertical:8),
    shape: RoundedRectangleBorder(borderRadius:BorderRadius.circular(8)),
    backgroundColor:CivicTokens.navy,foregroundColor:Colors.white,
    textStyle:const TextStyle(fontSize:13,height:1.55,fontWeight:FontWeight.w600),
  )),
  iconButtonTheme: IconButtonThemeData(style:IconButton.styleFrom(
    minimumSize:const Size(44,44),foregroundColor:CivicTokens.navy,
  )),
  inputDecorationTheme: InputDecorationTheme(
    filled:true,fillColor:CivicTokens.surface,
    contentPadding:const EdgeInsets.all(12),
    border:OutlineInputBorder(borderRadius:BorderRadius.circular(8),borderSide:const BorderSide(color:CivicTokens.controlBorder)),
    focusedBorder:OutlineInputBorder(borderRadius:BorderRadius.circular(8),borderSide:const BorderSide(color:CivicTokens.navy,width:2)),
  ),
);
