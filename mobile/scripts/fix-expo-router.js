/**
 * Fixes a bug in expo-router 4.0.17 where getPathFromState uses `this.config`
 * but is called as a standalone function by BottomTabBar, making `this` undefined.
 * Fix: capture the nav config in a closure variable instead.
 */
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../node_modules/expo-router/build/getLinkingConfig.js');

if (!fs.existsSync(target)) {
  console.log('fix-expo-router: file not found, skipping');
  process.exit(0);
}

let src = fs.readFileSync(target, 'utf8');

// Already patched?
if (src.includes('_navConfig')) {
  console.log('fix-expo-router: already patched, skipping');
  process.exit(0);
}

// 1. Capture config before the return statement
src = src.replace(
  ': undefined;\n    return {',
  ': undefined;\n    const _navConfig = getNavigationConfig(routes, metaOnly);\n    return {'
);

// 2. Use the captured variable as the config property
src = src.replace(
  'config: getNavigationConfig(routes, metaOnly),',
  'config: _navConfig,'
);

// 3. Use the captured variable inside getPathFromState instead of this.config
src = src.replace(
  '                ...this.config,',
  '                ..._navConfig,'
);

fs.writeFileSync(target, src);
console.log('fix-expo-router: patched getLinkingConfig.js successfully');
