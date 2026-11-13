import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryLabel, pickCategoryFolder } from '../supabase/functions/_shared/category.ts';

const folders = [
  { id: 'design', name: 'Design', position: 4 },
  { id: 'dev', name: 'Development', position: 5 },
  { id: 'productivity', name: 'Productivity', position: 9 },
];

test('AI topic chooses an exact existing category', () => {
  assert.equal(pickCategoryFolder(folders, 'Productivity', ['workflow'])?.id, 'productivity');
});

test('AI tags can choose a related existing category', () => {
  assert.equal(pickCategoryFolder(folders, 'Technology', ['software development'])?.id, 'dev');
});

test('unmatched AI topics create a clean category label', () => {
  assert.equal(pickCategoryFolder(folders, 'Cooking', ['recipes']), null);
  assert.equal(categoryLabel('  personal   knowledge management  '), 'Personal Knowledge Management');
});
