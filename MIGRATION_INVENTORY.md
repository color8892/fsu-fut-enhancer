# Migration Inventory

> Last audited: 2026-07-18

This inventory records the current migration boundary. It is descriptive, not the target
architecture. Update it in the same PR when a domain module becomes pure, a patch moves
phase, or an EA capability changes.

## Evidence Sources

- Patch order: `extension/src/fsu/core/PatchInstaller.js`
- Nested patch wiring: `patches/player-cards.js` and `patches/sbc-nav-events.js`
- EA method inventory: `extension/data/ea-bundle-baseline.json`
- Capability implementation: `extension/src/fsu/ea/EaRuntimeAdapter.js`
- Capability tests: `extension/tests/ea-runtime-adapter.test.mjs`
- Lifecycle kernel: `extension/src/fsu/core/PatchLifecycleRegistry.js`
- Lifecycle tests: `extension/tests/patch-lifecycle-registry.test.mjs`
- MV3 boundary smoke: `extension/tests/browser-smoke.mjs`
- Market result contracts: `extension/src/fsu/domain/MarketResults.js`
- Market boundary tests: `extension/tests/market-results.test.mjs`,
  `extension/tests/market-action-service.test.mjs`
- Price result contracts: `extension/src/fsu/domain/PriceResults.js`
- Price fixtures: `extension/tests/price-results.test.mjs`,
  `extension/tests/price-service.test.mjs`,
  `extension/tests/price-patch-lifecycle.test.mjs`
- Player metadata contracts: `extension/src/fsu/domain/PlayerMetadataResults.js`
- Player details fixtures: `extension/tests/player-metadata-results.test.mjs`,
  `extension/tests/player-details-lifecycle.test.mjs`
- Store pack catalog boundary: `extension/src/fsu/ea/StorePackCatalogAdapter.js`,
  `extension/src/fsu/domain/StorePackCatalogService.js`
- Store catalog/lifecycle fixtures: `extension/tests/store-pack-catalog.test.mjs`
- Pack-open transaction: `extension/src/fsu/domain/StorePackOpenTransactionService.js`,
  `extension/src/fsu/ea/StorePackOpenAdapter.js`
- Pack-open fixtures: `extension/tests/store-pack-open-transaction.test.mjs`
- In-packs pagination: `extension/src/fsu/domain/InPacksSearchService.js`,
  `extension/src/fsu/ea/InPacksSearchAdapter.js`
- In-packs fixtures: `extension/tests/in-packs-search.test.mjs`
- Store UI lifecycle fixtures: `extension/tests/store-ui-lifecycle.test.mjs`

The EA bundle baseline verifies that referenced classes and methods can be found in a
sanitized local bundle. It does not verify patch behavior, idempotence, restore, DOM
output, or cross-feature failure isolation.

The browser smoke loads the real manifest, background worker, content bridge and page
runtime in a Playwright persistent context. Its test-only userscript bundles the
production `PatchLifecycleRegistry`, `market.search-view-generate`,
`store.pack-list`, `store.pack-open-transaction` and `store.pack-animation`
descriptors against sanitized `UTMarketSearchView`, `UTStoreView`,
`UTStoreViewController` and `UTPackAnimationViewController` shells. It verifies
install, duplicate, disable, reinstall, exact restore and allowlisted diagnostics
alongside handshake, storage, background request policy and reload invalidation, without
live EA globals or account data.

## Domain Classification

Classification rules:

- `pure`: no ambient page/EA runtime; dependencies arrive through imports or arguments.
- `EA-boundary`: raw EA entities/services arrive through explicit arguments or helpers,
  but the module still understands EA-owned shapes or observable behavior.
- `legacy-domain`: reads ambient page globals such as `UT*`, `_`, EA enums,
  `services`, `repositories`, or `isPhone`.

| Class | Files | Current migration need |
|-------|-------|------------------------|
| `pure` | `InPacksSearchResults.js`, `InPacksSearchService.js`, `PlayerLockService.js`, `SbcChemistryService.js`, `SbcRequirementsService.js`, `SbcResponseAdapter.js`, `SbcSnapshotResults.js`, `SbcUndoHistoryService.js`, `StorePackCatalogService.js`, `StorePackOpenResults.js`, `lodashMixins.js` | Keep ambient-runtime free and add to strict island when contracts are complete. |
| `EA-boundary` | `FastSbcPlannerService.js`, `MarketActionService.js`, `PriceService.js`, `SbcSquadSaveService.js`, `StorePackOpenTransactionService.js` | Replace remaining raw EA entity/view shapes with small capability and renderer interfaces. |
| `legacy-domain` | `AcademyCalcService.js`, `BuildPreferencesService.js`, `FastSbcService.js`, `FgRatingService.js`, `Localization.js`, `OneFillCriteriaService.js`, `PlayerSearchService.js`, `PlayerValueService.js`, `RemoteConfigService.js`, `SbcCountService.js`, `SbcDataService.js`, `SbcPlayerMatchService.js`, `SbcRatingService.js`, `SbcSquadFillService.js`, `SbcTemplateService.js`, `SettingsService.js` | Remove ambient globals one vertical slice at a time; do not bulk-move files without behavior tests. |

Classification describes dependency direction, not business importance. A module may
remain under `domain/` while marked `legacy-domain`; the label prevents documentation
from presenting that location as proof of isolation.

## Patch Inventory

There are 94 direct prototype assignments under `patches/`. Ten of them define methods
on extension-owned Store controllers, leaving 84 direct EA assignments. Together with
one direct EA assignment inside `PatchInstaller` and 12 descriptor-managed production
patches, the EA lifecycle migration scope is 97. The ten Store controller methods and
four extension-owned prototype assignments in `ui/SettingsScreen.js` are implementation
details and must not be mixed into EA compatibility diagnostics.

`home.academy-tile`, `market.search-view-generate`, `price.squad-value`,
`details.quick-list-render`, `sbc.challenges-view`, `sbc.submit-transaction` and
`store.pack-list`, `store.pack-open-transaction`, `store.reveal-list`,
`store.pack-animation`, `store.category-navigation` and `store.hub-tiles` have direct
lifecycle behavior tests. For every other family, `EA baseline` below means target
compatibility evidence, not behavioral coverage.

The lifecycle kernel has unit coverage for install, duplicate, unsupported target,
verify/apply failure, failure isolation, sanitized diagnostics and reverse restore.

| Phase | Patch files and wiring | Direct EA assignments | Risk | Current test evidence |
|-------|------------------------|----------------------:|------|-----------------------|
| Pre-installer bootstrap | `app-init.js`; `home.academy-tile` uses lifecycle descriptor | 0 | Medium | Lifecycle behavior + EA baseline |
| `installEarly` | `unassigned.js`, `login.js`, `navigation.js`, `squad-builder.js`, `player-cards.js` -> `player-item.js` + `misc-item.js`; plus tactics-role assignment in `PatchInstaller` | 10 | Medium | EA baseline |
| `installHubAndLists` | `picks-rewards.js`, `squad-overview-view.js`, `sectioned-list.js`, `build-ignore.js`, `player-list.js`; `price.squad-value` uses lifecycle descriptor; `sbc-hub.js`, `academy-hub.js`, `sbc-nav-events.js` -> `sbc-challenges.js`; `sbc.challenges-view` uses lifecycle descriptor | 18 | Medium | Squad-value/challenges lifecycle behavior + EA baseline |
| `installSbcCore` | `player-bio.js`, `panel-patches.js`; `details.quick-list-render` uses lifecycle descriptor; `sbc-substitution.js`, `objectives-hub.js`, `home-hub.js` | 10 | Medium | Player-details lifecycle behavior + EA baseline |
| `installMarketAndSquad` | `market.js`; `market.search-view-generate` uses lifecycle descriptor; `store.js`; six Store patches use lifecycle descriptors and ten Store controller methods are extension-owned; `search-events.js`, submit portion of `sbc-squad.js`, `sbc-fill-events.js`, `sbc-fill-patches.js`, `sbc-tile-events.js`, `sbc-reward-events.js`, `sbc-fast.js` | 25 | High | Search/store lifecycle behavior + EA baseline |
| `installClubAndUi` | `club-select.js`, `club-select-events.js`, `club-select-search-patches.js`, `rewards.js`, `club-hub.js`, `list-filter-events.js`, `ui-utils.js`, `player-meta.js` | 13 | Medium | EA baseline |
| `installLate` | `sbc-submit.js`; `sbc.submit-transaction` uses lifecycle descriptor; `misc-patches.js`, requirements portion of `sbc-squad.js`, `lifecycle-patches.js`, `academy-details.js`, `sbc-squad-overview.js` | 9 | High | Submit lifecycle behavior + EA baseline |
| Late renderer only | `player-details.js` | 0 | Low | Indirect bundle symbol assertion |

Special wiring constraints:

- `installAppInitPatches` runs before `PatchInstaller.installAll()`.
- `home.academy-tile` installs from `registerAppInitEvents` at the same pre-installer
  bootstrap position as its former direct assignment.
- `player-cards.js` is the owner of the nested player-item and misc-item patches.
- `sbc-nav-events.js` installs `sbc-challenges.js`.
- `sbc-squad.js` spans two phases; submit hooks run in `installMarketAndSquad`, while
  requirements rendering runs in `installLate`.
- `market.search-view-generate` remains at its former position inside
  `installMarketPatches`; `events.setMarketSearchGenerateEnabled(false)` restores only
  the generated-view guard, and `true` reinstalls it idempotently.
- `price.squad-value` remains at its former position inside `player-list.js`;
  `events.setSquadPricePatchEnabled(false)` restores only the squad total renderer.
- `details.quick-list-render` preserves EA render-first ordering; its runtime toggle
  disables only FSU detail augmentation.
- `sbc.challenges-view` remains inside `installHubAndLists`; its runtime toggle restores
  only challenge-view augmentation, and malformed requirements skip rating controls.
- `sbc.submit-transaction` remains first inside `installLate`; duplicate challenge
  submissions are rejected before invoking EA, and timeout keeps the challenge locked
  until runtime reload to avoid an ambiguous second write.
- `store.pack-list` remains at the former `UTStoreView.setPacks` position. Invalid
  articles pass through to EA unchanged, while only validated snapshots participate in
  FSU grouping, sorting, count summaries and new-pack state.
- `store.pack-open-transaction` replaces the former immediate post-`eOpenPack` state
  mutation. A single global open intent is tracked; repeat-pack state commits only after
  the my-packs inventory count decreases. Rejection releases the lock, while timeout or
  inventory ambiguity remains fail-closed until runtime reload.
- `store.reveal-list`, `store.pack-animation`, `store.category-navigation` and
  `store.hub-tiles` remain at their former positions and have independent toggles.
  Reveal/category/hub preserve the EA method return value and isolate post-render
  augmentation failures. Animation supports an originally absent own method and removes
  the injected property on restore.
- The six `PatchInstaller` phases preserve legacy call order and must remain the
  compatibility layer while descriptors are introduced.

## EA Capability Inventory

Unsupported operations return `EA_CAPABILITY_UNAVAILABLE` diagnostics or a structured
false/null result instead of exposing raw EA services to domain modules.

| Capability | Adapter API | Required EA surface | Current consumer | Test |
|------------|-------------|---------------------|------------------|------|
| `authentication.utas-session` | `getUtasSessionId()` | `services.Authentication.utasSession.id` | Market request session refresh | Unit |
| `market.search` | `clearTransferMarketCache()`, `searchTransferMarket()` | `services.Item.clearTransferMarketCache`, `services.Item.searchTransferMarket` | Auction search and price probing | Unit |
| `market.query-model` | `createPlayerMarketSearch()` | `UTSearchCriteriaDTO`, `UTBucketedItemSearchViewModel`, search enums | Player market criteria/session | Unit |
| `market.currency-steps` | `incrementMarketPrice()` | `UTCurrencyInputControl` increment methods | Auction price probing | Unit |
| `item.move-to-club` | `moveItemsToClub()` | item move, localization, notification, pile and network-error runtime | Transfer-to-club action | Unit |
| `item.purchase-to-club` | `purchaseItemToClub()` | item bid/move, user currency, pile/currency/error enums | Single and batch purchase | Unit |
| `item.list-for-sale` | `listItemForSale()` | item list, localization, notification and network/error enums | Single and batch listing | Unit |
| `unassigned.reset` | `resetUnassignedItems()` | unassigned repository reset | Post-listing refresh | Unit |
| `item.static-data` | `getStaticItemData()` | `repositories.Item.getStaticDataByDefId` | Numeric player lookup | Unit |
| `item.purchase-capacity` | `isPurchaseCapacityReached()` | purchased pile enum and item cache count | Purchase precondition | Unit |
| `item.listing-inventory` | `findListingItem()`, `hasTransferListingCapacity()` | transfer/unassigned/club repositories, pile size and cache count | Listing precondition and item resolution | Unit |
| `sbc.requirement-read` | `readRequirement()` | EA requirement getter shape | Requirements renderer and challenge rating read | Unit |
| `sbc.set-repository` | `getSetName()` | `services.SBC.repository.sets.get` | Challenge need-list label | Unit |
| `sbc.localization` | `getEntityName()` | `UTLocalizationUtil`, `services.Localization` | Club/league/nation requirement labels | Unit |
| `sbc.chemistry-context` | `readChemistryContext()` | controller squad slots and current viewmodel index | Chemistry candidate inputs | Unit |
| `sbc.virtual-challenge` | `create()` | SBC/squad/item constructors, chemistry services and TeamConfig | Template and player-match simulation | Unit |
| `sbc.submit-challenge` | `observeOnce()` + `parseSbcSubmitResponse()` | `UTSBCService.submitChallenge` observable | Submit dedupe, count and completion state | Unit |
| `store.pack-catalog` | `snapshot()` | article fields, currency enum, `getPrice`, localization and pack value | Pack grouping, sorting and display summaries | Unit |
| `store.pack-open` | `prepare()`, `readCompletion()` | viewmodel pack selection, `isOpeningPack`, my-packs inventory | Duplicate guard and repeat-pack state commit | Unit + browser lifecycle |
| `store.in-packs-search` | `requestPage()` | `UTSearchCriteriaDTO`, `services.Item.searchConceptItems` observable | Bounded concept-player pagination | Unit |

Remote SBC squad responses are validated by `SbcSnapshotResults` before consumption.
Futbin player mappings and prices are committed through one validated
`commitFutbinSquadPlayers()` operation; malformed batches preserve both existing maps.

Template execution is owned by `CancellableOperation`; starting a new template invalidates
the previous token, and loader close explicitly cancels the active operation. Undo history
uses frozen per-step arrays and copy-on-write replacement instead of mutating snapshots.

SBC save/load observables are converted by `EaObservableAdapter` into bounded one-shot
promises with `unobserve`, timeout and capability diagnostics. `SbcSquadSaveService`
deduplicates in-flight saves per challenge, restores the original player snapshot on any
failure, and commits undo/template state only after save plus reload succeeds.

SBC submit validates challenge/set/canSubmit before invoking EA. Duplicate calls return
`SBC_SUBMIT_IN_FLIGHT`; timeout or observer failure retains the per-challenge lock until
runtime reload. Count, repeat-SBC state and completion refresh only run after a validated
EA success response.

Store pack articles are read through `StorePackCatalogAdapter`; getter, localization and
shape failures become per-item warnings. `StorePackCatalogService` groups and sorts only
validated snapshots. Invalid or frozen articles remain in the list passed to EA, and
`store.pack-list` can be independently disabled and restored.

Pack-open selection and inventory completion are validated by `StorePackOpenAdapter`.
`StorePackOpenTransactionService` permits only one tracked my-pack intent, suppresses
duplicates, commits repeat-pack state after inventory-confirmed completion, releases on
rejection, and retains an ambiguous timeout lock until runtime reload. Adapter/precondition
drift calls the original EA method without committing FSU state.

In-packs concept search uses `InPacksSearchAdapter` for criteria construction, one-shot
observable timeout and strict page schema. `InPacksSearchService` limits requests to 200
items per page, 10 pages and a 100ms inter-page delay. New searches invalidate prior
tokens; navigation drift, cancellation, malformed pages, timeout and max-page exhaustion
return partial results without mutating `info.inpacks.players`. Configured players are
committed atomically only after a complete successful search.

## Next Inventory Changes

The planned Store vertical slice is complete. The next lifecycle expansion must:

1. Select one patch family from the active vertical slice, not a broad phase conversion.
2. Add stable descriptor IDs, exact targets, dependencies and restore behavior.
3. Add behavior fixtures before replacing direct assignments.
4. Preserve `PatchInstaller` phase order and isolate unsupported members by feature.

`MarketActionService` is now `EA-boundary`: direct Lodash `_`, `UT*` constructor,
`MAX_NEW_ITEMS`, `services` and `repositories` dependencies have been removed. Auction
price rows are passed to `MarketAuctionRenderer`, and auction/search/purchase/listing
responses pass through runtime result contracts. It becomes `pure` only after remaining
EA entity and view/controller shapes are replaced by explicit interfaces.
