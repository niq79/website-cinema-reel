export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function arrow() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', 'M5 12h14m-6-6 6 6-6 6');
  svg.append(path);
  return svg;
}

const FALLBACK_OVERLAY = Object.freeze({
  mode:'both',
  color:'#000000',
  linear:{ angle:180, stops:[
    { position:0, opacity:0.42 },
    { position:22, opacity:0.06 },
    { position:70, opacity:0.04 },
    { position:100, opacity:0.55 },
  ] },
  radial:{ centerX:50, centerY:50, width:80, height:70, clearUntil:40, edgeOpacity:0.45 },
});

function rgba(hex, opacity) {
  const value = hex.replace('#', '');
  const number = Number.parseInt(value, 16);
  return `rgba(${number >> 16},${number >> 8 & 255},${number & 255},${opacity})`;
}

export function overlayBackground(input = FALLBACK_OVERLAY) {
  const overlay = input || FALLBACK_OVERLAY;
  const gradients = [];
  if (overlay.mode === 'radial' || overlay.mode === 'both') {
    const radial = overlay.radial || FALLBACK_OVERLAY.radial;
    gradients.push(`radial-gradient(${radial.width}% ${radial.height}% at ${radial.centerX}% ${radial.centerY}%,${rgba(overlay.color, 0)} ${radial.clearUntil}%,${rgba(overlay.color, radial.edgeOpacity)} 100%)`);
  }
  if (overlay.mode === 'linear' || overlay.mode === 'both') {
    const linear = overlay.linear || FALLBACK_OVERLAY.linear;
    const stops = linear.stops.map(stop => `${rgba(overlay.color, stop.opacity)} ${stop.position}%`).join(',');
    gradients.push(`linear-gradient(${linear.angle}deg,${stops})`);
  }
  return gradients.length ? gradients.join(',') : 'none';
}

function legacyFocus(position = 'center') {
  const normalized = position.trim().toLowerCase();
  if (normalized === 'center') return { x:50, y:50 };
  const values = normalized.split(/\s+/);
  if (values.length === 1 && ['top', 'bottom'].includes(values[0])) return { x:50, y:values[0] === 'top' ? 0 : 100 };
  const keyword = value => ({ left:0, top:0, center:50, right:100, bottom:100 }[value] ?? 50);
  const number = value => value?.endsWith('%') ? Number.parseFloat(value) : keyword(value);
  return { x:number(values[0]), y:number(values[1] || 'center') };
}

export function focusFor(card, device = 'desktop') {
  const legacy = legacyFocus(card.image.position);
  const desktop = card.image.focus?.desktop || legacy;
  return device === 'mobile' ? card.image.focus?.mobile || desktop : desktop;
}

export function imageSource(card) {
  return card.image.src.startsWith('/') ? new URL(`..${card.image.src}`, import.meta.url).href : card.image.src;
}

function imageFor(card, className) {
  const img = element('img', className);
  // Content paths are relative to the site root, including on GitHub project Pages.
  img.src = imageSource(card);
  img.alt = card.image.alt;
  const desktop = focusFor(card);
  const mobile = focusFor(card, 'mobile');
  img.style.setProperty('--focus-desktop', `${desktop.x}% ${desktop.y}%`);
  img.style.setProperty('--focus-mobile', `${mobile.x}% ${mobile.y}%`);
  img.draggable = false;
  img.decoding = 'async';
  return img;
}

export function frameFor(card, index, total, duplicate = false) {
  const slide = element('article', 'slide');
  slide.dataset.layout = card.layout;
  slide.dataset.index = index;
  if (duplicate) slide.dataset.duplicate = 'true';
  slide.setAttribute('aria-roledescription', 'slide');
  slide.setAttribute('aria-label', `${index + 1} of ${total}: ${card.title.join(' ')}`);
  const frame = element('div', 'frame');
  const img = imageFor(card, 'card-image');
  if (index === 0 && !duplicate) img.fetchPriority = 'high';
  const content = element('div', 'card-content');
  const top = element('div', 'card-top');
  top.append(element('span', 'eyebrow', card.eyebrow || ''), element('span', 'year', card.year || ''));
  const heading = element('div', 'card-heading');
  if (card.category) heading.append(element('p', 'category', card.category));
  const title = element('h2', 'card-title');
  card.title.forEach(line => title.append(element('span', '', line)));
  heading.append(title);
  if (card.summary) heading.append(element('p', 'card-summary', card.summary));
  content.append(top, heading);
  if (card.credit) {
    const credit = element('div', 'credit');
    credit.append(element('span', 'credit-label', card.credit.label), element('span', 'credit-value', card.credit.value));
    content.append(credit);
  }
  if (card.layout === 'cinematic' && card.highlights?.length) {
    const list = element('ul', 'highlights');
    for (const item of card.highlights) {
      const li = element('li');
      if (item.stars) {
        const stars = element('div', 'highlight-stars', '★'.repeat(item.stars));
        stars.setAttribute('aria-label', `${item.stars} out of 5 stars`);
        li.append(stars);
      }
      li.append(element('div', 'highlight-label', item.label), element('p', 'highlight-quote', `“${item.quote}”`));
      list.append(li);
    }
    content.append(list);
  }
  if (card.details) {
    const button = element('button', 'explore', card.details.label || 'Explore');
    button.type = 'button';
    button.dataset.detail = index;
    button.setAttribute('aria-haspopup', 'dialog');
    button.append(arrow());
    content.append(button);
  }
  const media = element('div', 'card-media');
  const parallax = element('div', 'image-parallax');
  const soft = imageFor(card, 'card-image image-soft');
  soft.alt = '';
  soft.setAttribute('aria-hidden', 'true');
  const frost = element('div', 'image-frost');
  frost.setAttribute('aria-hidden', 'true');
  parallax.append(img, soft);
  media.append(parallax, frost);
  const shade = element('div', 'image-shade');
  if (card.image.overlay) {
    shade.style.setProperty('--overlay-desktop', overlayBackground(card.image.overlay));
    shade.style.setProperty('--overlay-mobile', overlayBackground(card.image.overlay.mobile || card.image.overlay));
  }
  frame.append(media, shade, content);
  slide.append(frame);
  return slide;
}

export function detailFor(card) {
  const fragment = document.createDocumentFragment();
  fragment.append(imageFor(card, 'detail-image'));
  const body = element('div', 'detail-body');
  if (card.eyebrow) body.append(element('span', 'detail-eyebrow', card.eyebrow));
  const title = element('h2', 'detail-title', card.title.join(' '));
  title.id = 'detail-title';
  const credit = [card.credit?.value, card.year, card.category].filter(Boolean).join(' · ');
  body.append(title, element('div', 'detail-credit', credit));
  card.details.paragraphs.forEach(text => body.append(element('p', '', text)));
  if (card.details.facts?.length) {
    const facts = element('dl', 'detail-facts');
    card.details.facts.forEach(item => {
      const fact = element('div', 'fact');
      fact.append(element('dt', '', item.label), element('dd', '', item.value));
      facts.append(fact);
    });
    body.append(facts);
  }
  fragment.append(body);
  return fragment;
}
