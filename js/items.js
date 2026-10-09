// Item definitions

export const ITEMS = {
  stone_axe: {
    id: 'stone_axe',
    name: 'Stone Axe',
    weight: 1.6,
    note: 'Hafted by hand. A chipped flint head lashed with sinew. Still holds an edge.'
  },
  stone_pickaxe: {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    weight: 1.9,
    note: 'Heavier than the axe. The grip is worn smooth in one place.'
  },
  faded_photograph: {
    id: 'faded_photograph',
    name: 'Faded Photograph',
    weight: 0.05,
    note: 'A man and a boy on a porch. Autumn. You cannot tell the year.'
  },
  rusted_logbook: {
    id: 'rusted_logbook',
    name: 'Rusted Logbook',
    weight: 0.7,
    note: '"Day 41. The creek is low. I keep the light on in case."'
  },
  binoculars: {
    id: 'binoculars',
    name: 'Binoculars',
    weight: 0.9,
    note: 'Brass, cold to the touch. The valley looks smaller through them.'
  },
  hand_drawn_map: {
    id: 'hand_drawn_map',
    name: 'Hand-drawn Map',
    weight: 0.1,
    note: 'Contour lines in pencil. A circle on the ridge. "He liked it up here."'
  }
};

export function getItem(id) {
  return ITEMS[id] || null;
}

export function itemName(id) {
  const it = ITEMS[id];
  return it ? it.name : id;
}

export function itemWeight(id) {
  const it = ITEMS[id];
  return it ? it.weight : 0;
}
