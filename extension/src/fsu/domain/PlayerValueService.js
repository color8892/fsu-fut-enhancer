/**
 * Determines whether a common/rare player at a given rating should be treated as precious.
 */
export class PlayerValueService {
  /**
   * @param {() => { base: { price: Record<number, number> } }} getInfo
   */
  constructor(getInfo) {
    this.getInfo = getInfo;
  }

  /**
   * @param {number} rating
   * @param {number} flag - ItemRarity flag
   * @param {number} price
   * @param {number} type - price source type (0 = market)
   */
  isPrecious(rating, flag, price, type) {
    if ((Number(flag) === ItemRarity.NONE || Number(flag) === ItemRarity.RARE) && type === 0) {
      const info = this.getInfo();
      if (price == 0 || _.gte(price, 2 * info.base.price[rating])) {
        return true;
      }
      return false;
    }
    return false;
  }
}