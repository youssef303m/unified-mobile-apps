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
  subtitleSize: `${P}subtitle_size`,
  subtitleTextColor: `${P}subtitle_text_color`,
  subtitleBgColor: `${P}subtitle_bg_color`,
  subtitlePosition: `${P}subtitle_position`,
  /** N-06 (phone only): keep playing with the screen off or the app in the background. */
  backgroundAudio: `${P}mobile_background_audio`,
  keepConnection: `${P}keep_connection`,
  isRefresh: `${P}isRefresh`,
  smartProxyConnectionState: `${P}smart_proxy_connection_state`,
  smartProxyRegion: `${P}smart_proxy_region`,
  smartProxyCountry: `${P}smart_proxy_country`,
  smartProxyServer: `${P}smart_proxy_server`,
  weatherForecast: `${P}weather-forecast`,
} as const;

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
  // Phone-only keys (docs/decisions.md D-058): how often each category was opened (the Home
  // category rows, N-01) and the recent search queries (Search screen).
  categoryOpens: `${P}${pid}_mobile_category_opens`,
  recentSearches: `${P}${pid}_mobile_recent_searches`,
});

/** The stored list type for a content kind. */
export const listTypeFor = (kind: "live" | "movie" | "series"): ListType =>
  kind === "movie" ? "vod" : kind;
