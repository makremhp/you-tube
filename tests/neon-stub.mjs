import { PGlite } from '@electric-sql/pglite';

// قاعدة PGlite = PostgreSQL حقيقي داخل الذاكرة (نفس صيغة SQL: CTE وON CONFLICT وFOR UPDATE).
// ملاحظة صريحة: PGlite يعمل باتصال واحد، فتُنفَّذ الاستعلامات بالتتابع؛ لذلك اختبارات «الطلبات المتزامنة»
// تثبت أن المنطق ذرّي داخل استعلام واحد (لا قراءة ثم كتابة في JavaScript) لا أنها تقيس تنافس اتصالات متعددة.
const db = (globalThis.__testDb ??= new PGlite());

export function neon() {
  return {
    async query(text, params = []) {
      const pattern = globalThis.__failQueryPattern;
      if (pattern && pattern.test(text)) {
        const error = new Error('simulated database failure');
        error.code = '08006';
        throw error;
      }
      const result = await db.query(text, params);
      return result.rows;
    },
  };
}
