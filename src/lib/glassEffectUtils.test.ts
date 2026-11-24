import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGlassSurfaceClasses } from './glassEffectUtils';

test('resolves liquid26 navigation bar glass classes with interactive and scheme modifiers', () => {
  const cls = resolveGlassSurfaceClasses({
    glassEffectStyle: 'liquid26',
    variant: 'bar',
    isInteractive: true,
    colorScheme: 'light',
    className: 'rounded-full',
  });
  assert.equal(
    cls,
    'ios26-liquid-glass-nav expo-liquid-glass-interactive expo-glass-scheme-light rounded-full'
  );
});

test('resolves liquid26 pill glass classes for dark mode', () => {
  const cls = resolveGlassSurfaceClasses({
    glassEffectStyle: 'liquid26',
    variant: 'pill',
    colorScheme: 'dark',
  });
  assert.equal(cls, 'ios26-liquid-glass-pill expo-glass-scheme-dark');
});

test('returns only custom className when glassEffectStyle is none', () => {
  const cls = resolveGlassSurfaceClasses({
    glassEffectStyle: 'none',
    variant: 'bar',
    isInteractive: true,
    className: 'custom-bar',
  });
  assert.equal(cls, 'custom-bar');
});

test('resolves regular and clear expo-glass-effect presets cleanly', () => {
  assert.equal(
    resolveGlassSurfaceClasses({ glassEffectStyle: 'regular', variant: 'button' }),
    'expo-liquid-glass-btn'
  );
  assert.equal(
    resolveGlassSurfaceClasses({ glassEffectStyle: 'clear', variant: 'bar' }),
    'expo-liquid-glass-bar expo-liquid-glass-clear'
  );
});
