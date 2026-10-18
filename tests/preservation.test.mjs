import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/original-manifest.json'), 'utf8'));
const read = (file) => readFileSync(resolve(root, file), 'utf8');

describe('عدم فقدان الملفات والمسارات والأصول (مقارنة بالمشروع الأصلي)', () => {
  test('كل ملف كان في المشروع الأصلي ما زال موجودًا (صفحات، مكوّنات، أصول، خادم، إعدادات)', () => {
    const missing = manifest.files.filter((file) => !existsSync(resolve(root, file)));
    assert.deepEqual(missing, []);
  });

  test('كل مسار API في الراوتر الأصلي ما زال معرّفًا', () => {
    const router = read('server/router.js');
    const missing = manifest.routeKeys.filter((key) => !router.includes(`key === '${key}'`));
    assert.deepEqual(missing, []);
    for (const resource of manifest.resources) assert.ok(router.includes(`resource === '${resource}'`), resource);
  });

  test('مسارات الواجهة /watch و/ ما زالت موجودة ومترجمة للعربية والإنجليزية مع RTL/LTR', () => {
    const router = read('src/pages/Router.tsx');
    assert.ok(router.includes('path="/watch"') && router.includes('path="/"'));
    const i18n = read('src/i18n.ts');
    assert.ok(i18n.includes("language === 'ar' ? 'rtl' : 'ltr'"));
    assert.ok(/\bar\b/.test(i18n) && /\ben\b/.test(i18n));
  });

  test('لا أسرار حقيقية داخل الملفات المصدرية أو الواجهة', () => {
    const files = ['src/lib/api.ts', 'src/App.tsx', 'index.html', 'vercel.json', 'package.json'];
    for (const file of files) {
      const text = read(file);
      assert.equal(/\b\d{8,10}:[A-Za-z0-9_-]{35}\b/.test(text), false, `${file}: نمط توكن بوت`);
      assert.equal(/postgres(ql)?:\/\/[^\s'"]+:[^\s'"]+@/.test(text), false, `${file}: رابط قاعدة بيانات بكلمة مرور`);
    }
  });
});
