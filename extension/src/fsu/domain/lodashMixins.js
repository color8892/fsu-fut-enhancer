export function applyFsuLodashMixins(lodashRef) {
  lodashRef.mixin({
    multicombinations(target, count) {
      const values = lodashRef.values(target);
      const combine = (items, remaining) => {
        if (--remaining < 0) {
          return [[]];
        }

        const results = [];
        const working = items.slice();

        while (working.length) {
          const current = working[0];
          combine(working, remaining).forEach((combo) => {
            combo.unshift(current);
            results.push(combo);
          });
          working.shift();
        }

        return results;
      };

      return combine(values, count);
    }
  });
}