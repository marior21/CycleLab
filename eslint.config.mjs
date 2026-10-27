import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['out/**','node_modules/**','design/**']}, js.configs.recommended, ...ts.configs.recommended, {files:['**/*.{ts,tsx,mjs}'],languageOptions:{globals:{console:'readonly',process:'readonly',URL:'readonly',setTimeout:'readonly',fetch:'readonly',Buffer:'readonly'}},rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}});
