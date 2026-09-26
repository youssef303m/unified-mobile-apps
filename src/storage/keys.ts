// Every persisted key, with the TV names (02-backend/data-models.md §12, settings.md §4,
// overview.md §5). `{P}` = the storage prefix, `{pid}` = the playlist id, concatenated without a
// separator as on TV (`gz3rYzUIC7_4821live_favourite`). Pure: no storage access here.
import { config } from "@/config";

export const P = config.app.storagePrefix;

export type ListType = "live" | "vod" | "series";

export const globalKeys = {
  termsApproved: `${P}termsApproved`,
  language: `${P}language`,
  playlistId: `${P}playlist_id`,
  playlist: `${P}playlist`,
  apiData: `${P}api_data`,
  localData: `${P}local_data`,
  v4Uid: `${P}v4_uid`,
  v4Token: `${P}v4_token`,
  parentPin: `${P}parent_account_password`,
  loadOnDemand: `${P}load_on_demand`,
  vodSort: `${P}vod_sort`,
  seriesSort: `${P}series_sort`,
  liveSort: `${P}live_sort`,
  streamFormat: `${P}stream_format`,
  tmdbChoice: `${P}tmdb_choice`,
  homeFavoritesChoice: `${P}home_favorites_choice`,
  liveInitializationChoice: `${P}live_initialization_choice`,
  appInitializationChoice: `${P}app_initialization_choice`,
  autoSwitchPlaylist: `${P}auto_switch_playlist`,
  stalkerStbProfile: `${P}stalker_stb_profile`,
  customCategories: `${P}custom_categories`,
  customCategoriesEnabled: `${P}custom_categories_enabled`,
  mySportsChannels: `${P}wc_my_channel_ids`,
  savedMovieInfo: `${P}saved-movie-info`,
  allPlaylistsInfo: `${P}all_playlists_info`,
  autoPlay: `${P}auto_play`,
  keepConnection: `${P}keep_connection`,
  isRefresh: `${P}isRefresh`,
  smartProxyConnectionState: `${P}smart_proxy_connection_state`,
  smartProxyRegion: `${P}smart_proxy_region`,
  smartProxyCountry: `${P}smart_proxy_country`,
  smartProxyServer: `${P}smart_proxy_server`,
  weatherForecast: `${P}weather-forecast`,
  analyticsActive: `${P}analytics_active`,
  analyticsSessions: `${P}analytics_sessions`,
} as const;

/** Keys kept by Clear Cache (R-120): the analytics session and buffer. */
export const CLEAR_CACHE_KEEP: readonly string[] = [
  globalKeys.analyticsActive,
  globalKeys.analyticsSessions,
];

/** The TV's unprefixed keys. */
export const unprefixedKeys = {
  stalkerMac: "stalker_mac",
} as const;

export const playlistKeys = (pid: string) => ({
  favourites: (type: ListType) => `${P}${pid}${type}_favourite`,
  hiddens: (type: ListType) => `${P}${pid}${type}_hiddens`,
  liveRecent: `${P}${pid}live_recent`,
  savedVodTimes: `${P}${pid}_saved_vod_times`,
  savedSeriesTimes: `${P}${pid}_saved_series_times`,
  categoryOrders: `${P}${pid}_category_orders`,
  channelOrders: `${P}${pid}_channel_orders`,
  liveCategoryArrangement: `${P}${pid}_live_category_arrangement`,
  customMembers: (type: ListType, catId: string) => `${P}${pid}${type}_cc_${catId}`,
  stalkerObjects: (type: ListType, list: "recent" | "favourite") =>
    `${P}${pid}_stalker_${type}_${list}_objs`,
  stalkerCustomMembers: (type: ListType, catId: string) =>
    `${P}${pid}_stalker_${type}_cc_${catId}_objs`,
});

/** The stored list type for a content kind. */
export const listTypeFor = (kind: "live" | "movie" | "series"): ListType =>
  kind === "movie" ? "vod" : kind;
