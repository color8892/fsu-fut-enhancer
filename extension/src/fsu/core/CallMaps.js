/**
 * EA prototype backup maps used by patch installers.
 */

export function createViewCallMap(patchRegistry) {
  return patchRegistry.createViewMap({
    card: UTPlayerItemView.prototype.renderItem,
    miscItem: UTMiscItemView.prototype.renderItem,
    unassigned: UTUnassignedItemsViewController.prototype.renderView,
    build: UTSquadBuilderViewController.prototype.viewDidAppear,
    market: UTMarketSearchView.prototype._generate,
    setting: UTAppSettingsView.prototype._generate,
    squadRating: UTSquadEntity.prototype._calculateRating,
    transfer: UTTransferListViewController.prototype._renderView,
    clubHub: UTClubHubView.prototype.clearTileContent,
    ea: EAViewController.prototype.viewDidAppear,
    push: UTGameFlowNavigationController.prototype.didPush,
    login: UTLoginView.prototype._generate,
    tacticsRole: UTTacticsRoleSelectViewController.prototype.viewDidAppear,
    transferMarket: UTTransferMarketPaginationViewModel.prototype.startAuctionUpdates,
    unassignedRenderSection: UTUnassignedItemsView.prototype.renderSection,
    unassignedUpdateUDSO:
      UTUnassignedItemsViewController.prototype.updateUntradeableDuplicateSectionOptions
  });
}

export function createCallMaps() {
  return {
    plist: {
      sectioned: UTSectionedItemListView.prototype.addItems,
      paginated: UTPaginatedItemListView.prototype.renderItems,
      storeReveal: UTStoreRevealModalListView.prototype.addItems,
      club: UTClubRepository.prototype.removeClubItem,
      squadSet: UTSquadEntity.prototype.setPlayers,
      squadGR: UTSquadEntity.prototype.getRating,
      squad: UTSquadOverviewViewController.prototype.viewDidAppear
    },
    selectClub: {
      updata: UTSelectItemFromClubViewController.prototype.updateItemList,
      request: UTSelectItemFromClubViewController.prototype.requestItems,
      handle: UTSelectItemFromClubViewController.prototype.handleItemRetrieval
    },
    other: {
      uaTile: UTUnassignedTileView.prototype.setNumberOfItems,
      store: {
        setPacks: UTStoreView.prototype.setPacks,
        setCategory: UTStoreViewController.prototype.setCategory
      },
      market: {
        eSearch: UTMarketSearchFiltersViewController.prototype.eSearchSelected,
        setFilter: UTMarketSearchFiltersView.prototype.setFilters
      },
      rewards: {
        choice: UTRewardSelectionChoiceViewController.prototype.viewDidAppear,
        popupTapped: UTGameRewardsViewController.prototype.onButtonTapped,
        objectiveDetail: FCObjectiveDetailsView.prototype.render,
        choiceSet: UTRewardSelectionChoiceView.prototype.expandRewardSet,
        check: {
          FC: FCGameRewardsViewController.prototype.checkRewards,
          UT: UTGameRewardsViewController.prototype.checkRewards
        }
      },
      localize: EALocalizationService.prototype.localize,
      picks: {
        setItems: UTPlayerPicksView.prototype.setCarouselItems
      }
    },
    task: {
      sbcT: UTSBCHubView.prototype.populateTiles,
      sbcN: UTSBCHubView.prototype.populateNavigation,
      objN: UTObjectivesHubView.prototype.populateNavigation,
      objG: UTObjectiveCategoryView.prototype.setCategoryGroups,
      home: UTHomeHubView.prototype._generate,
      objSetTitle: UTObjectivesHubTileView.prototype.setSubtitle,
      sbcSetDate: UTSBCSetTileView.prototype.setData,
      rewardList: UTSBCGroupRewardListView.prototype.setRewards,
      seasonSet: FCObjectiveSeasonView.prototype.setCampaign
    },
    panel: {
      quickRender: UTQuickListPanelViewController.prototype.renderView,
      market: UTMarketSearchFiltersView.prototype.setPinnedItem,
      reward: UTRewardSelectionChoiceView.prototype.expandRewardSet
    },
    search: {
      club: {
        viewDid: UTClubSearchFiltersViewController.prototype.viewDidAppear,
        modeChange: UTClubSearchFiltersViewController.prototype.onSearchModeChanged,
        setChemDiff: UTClubSearchResultsView.prototype.setItemsWithChemDiff
      },
      filters: UTItemSearchView.prototype.setFilters,
      result: UTPaginatedItemListView.prototype.setPaginationState,
      dropdownOpen: UTDropDownControl.prototype.open,
      request: UTClubSearchResultsViewController.prototype._requestItems,
      setHeader: UTClubSearchResultsViewController.prototype.setupHeader
    },
    squad: {
      setPlayers: UTSquadEntity.prototype.setPlayers,
      swapPlayers: UTSquadEntity.prototype.swapPlayersByIndex,
      addItem: UTSquadEntity.prototype.addItemToSlot,
      removeItem: UTSquadEntity.prototype.removeItemFromSlot,
      removeAll: UTSquadEntity.prototype.removeAllItems,
      submitted: UTSBCSquadOverviewViewController.prototype._onChallengeSubmitted,
      submit: UTSBCSquadOverviewViewController.prototype._submitChallenge,
      requirements: UTSBCChallengeRequirementsView.prototype.renderChallengeRequirements
    }
  };
}