export const HTML_TEMPLATES = {
  priceBtn:
    '<button class="flat pagination fsu-getprice" id="getprice">{price.btntext}</button>',
  priceBtn2:
    '<button class="btn-standard section-header-btn mini call-to-action fsu-getprice" id="getprice">{price.btntext}</button>',
  sbcInfo:
    '<div class="fsu-sbc-info"><div class="currency-coins">{sbc.price}{price}</div><div><span>{sbc.like}{up}</span><span>{sbc.dislike}{down}</span></div></div>',
  consultBtn:
    '<a href="https://www.futbin.com/squad-building-challenges/ALL/{sbcId}" target="_blank" class="fsu-consult fsu-sbcButton">{sbc.consult}</a>',
  countBtn:
    '<a id="goToCount" href="javascript:void(0)" class="fsu-count">{sbc.count}</a>',
  searchInput:
    '<input type="text" class="fsu-input" placeholder="{text}" maxlength="50">',
  uasBtn:
    '<button class="btn-standard section-header-btn mini call-to-action fsu-getprice" id="uasreset">{uasreset.btntext}</button>'
};