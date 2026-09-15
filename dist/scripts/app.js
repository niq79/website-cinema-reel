import { validateCollection } from './content.js';
import { CinemaReel } from './reel.js';

try {
  const response = await fetch(new URL('../content/cards.json', import.meta.url));
  if (!response.ok) throw new Error('The card collection could not be loaded.');
  const data = validateCollection(await response.json());
  document.querySelector('#page-title').textContent = data.site.title;
  document.querySelector('#viewport').setAttribute('aria-label', data.site.collection || 'Card collection');
  document.title = data.site.title;
  document.querySelector('meta[name="description"]').content = data.site.description || '';
  const reel = new CinemaReel(data);
  const query = new URLSearchParams(location.search);
  if (query.get('edit') === '1') {
    const { createCardEditor } = await import('./editor.js');
    createCardEditor(reel, data);
  }
  if (query.get('debug') === '1') {
    const { createMotionPanel } = await import('./debug.js');
    createMotionPanel(reel);
  }
} catch (error) {
  const notice = document.querySelector('#load-error');
  notice.hidden = false;
  notice.textContent = `Unable to open the collection. ${error.message}`;
  document.querySelector('.reel-nav').hidden = true;
  console.error(error);
}
