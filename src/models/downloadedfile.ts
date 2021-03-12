import { Stream } from "node:stream";

export class DownloadedFile {
    filename:string;
    stream:Stream;
}