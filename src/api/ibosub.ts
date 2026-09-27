// External subtitles from ibosub.com (01-product/player.md §5.3): the list for a TMDB id, then one
// file's SRT text when the list's `srt_map` does not already hold it. Form-encoded POSTs, no auth.
import { config } from "@/config";

import { ParseError } from "./errors";
import { expectOk, FORM_CONTENT_TYPE, formEncode, parseJson, send } from "./http";
import { asArray, asObject, str } from "./parse";

export interface IbosubFile {
  fileId: string;
  language: string;
}

export interface IbosubList {
  files: IbosubFile[];
  /** SRT texts already sent with the list, by file id. */
  srtMap: Record<string, string>;
  movieListId: string;
}

export type IbosubQuery =
  | { kind: "movie"; tmdbId: string }
  | {
      kind: "episode";
      seriesTmdbId?: string;
      episodeTmdbId?: string;
      seasonNumber: number;
      episodeNumber: number;
    };

/** The form fields of §5.3 step 2. */
export function ibosubFields(query: IbosubQuery): Record<string, string | number> {
  if (query.kind === "movie") return { tmdb_id: query.tmdbId };
  if (!query.seriesTmdbId && query.episodeTmdbId)
    return { movie_type: "episode", episode_tmdb_id: query.episodeTmdbId };
  return {
    movie_type: "episode",
    season_number: query.seasonNumber,
    episode_number: query.episodeNumber,
    tmdb_id: query.seriesTmdbId ?? "",
    ...(query.episodeTmdbId ? { episode_tmdb_id: query.episodeTmdbId } : {}),
  };
}

async function post(url: string, fields: Record<string, string | number>, signal?: AbortSignal) {
  const response = expectOk(
    await send({
      url,
      method: "POST",
      headers: { "Content-Type": FORM_CONTENT_TYPE },
      body: formEncode(fields),
      signal,
    }),
  );
  const body = asObject(parseJson(response.text));
  if (str(body.status) !== "success") throw new ParseError("ibosub: status is not success");
  return body;
}

export async function ibosubList(query: IbosubQuery, signal?: AbortSignal): Promise<IbosubList> {
  const body = await post(config.subtitles.searchUrl, ibosubFields(query), signal);
  const map = asObject(body.srt_map);
  return {
    files: asArray(body.subtitles)
      .map((s) => asObject(s))
      .map((s) => ({ fileId: str(s.file_id), language: str(s.language) }))
      .filter((f) => f.fileId !== ""),
    srtMap: Object.fromEntries(
      Object.entries(map).filter((e): e is [string, string] => typeof e[1] === "string"),
    ),
    movieListId: str(body.movie_list_id),
  };
}

export async function ibosubContent(
  movieListId: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<string> {
  const body = await post(
    config.subtitles.contentUrl,
    { movie_list_id: movieListId, file_id: fileId },
    signal,
  );
  return str(body.content);
}
