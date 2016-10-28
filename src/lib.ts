
import { join } from 'path';
import * as fs from 'fs';
import * as Promise from 'bluebird';
import { parse as parse_querystring } from 'querystring';
import { get } from 'http';

Promise.promisifyAll(fs, { suffix: 'P' });

const video_url_id_extractor = /https?:\/\/.*?\?v=([A-z0-9\-_]+)\b/;

export
const queue_data_path = join(__dirname, '../', 'video-queue.json');
export
const queue_lock_path = join(__dirname, '../', 'video-queue.lock');

function video_id_from_url_or_id(url_or_id: string)
{
    if (video_url_id_extractor.test(url_or_id))
    {
        let result = video_url_id_extractor.exec(url_or_id);
        return result[1];
    }
    else
    {
        return url_or_id;
    }
}

export
function create_video_entry(url_or_id: string)
{
    const video_id = video_id_from_url_or_id(url_or_id);
    return fetch_youtube_video_infoP(video_id)
        .then((info) => new VideoEntry(info.title, video_id, false, info.blocked))
    ;
}

export
class VideoEntry
{
    public readonly video_id: string;

    public constructor(
        public readonly title: string,
        url_or_id: string,
        public done?,
        public blocked_in_germany?,
        public blocked_everywhere?
    )
    {
        this.video_id = video_id_from_url_or_id(url_or_id);
    }
}

/// (Possibly infinitely) file-based locking mechanism.
function file_semaphore(lock: string, fn: () => void)
{
    try
    {
        fs.accessSync(lock);
        setTimeout(() => file_semaphore(lock, fn), 500);
    }
    catch (e)
    {
        fs.openP(lock, 'wx')
            .then((fd) =>
            {
                fn();
                return fd;
            })
            .then((fd) =>
            {
                fs.close(fd);
                fs.unlink(lock);
            })
            .catch((e) => { throw e; })
        ;
    }
}

export
const semaphoreP = Promise.promisify(file_semaphore);

export
function retrieve_data(from = queue_data_path): Promise<VideoEntry[]>
{
    return fs.readFileP(from)
        .then((json) => JSON.parse(json), () => [])
    ;
}

export
function retrieve_dataP(from = queue_data_path, lock = queue_lock_path): Promise<VideoEntry[]>
{
    return semaphoreP(lock)
        .then(() => fs.readFileP(from))
        .then((json) => JSON.parse(json), () => [])
    ;
}

export
function write_data(data: VideoEntry[], to = queue_data_path): Promise<void>
{
    return fs.writeFileP(to, JSON.stringify(data));
}

export
function write_dataP(data: VideoEntry[], to = queue_data_path, lock = queue_lock_path): Promise<void>
{
    return semaphoreP(lock)
        .then(() => fs.writeFileP(to, JSON.stringify(data)))
    ;
}

const fetch_youtube_video_infoP = Promise.promisify(fetch_youtube_video_info);

function fetch_youtube_video_info(video_id, fn: (err: string|null, succ?) => void)
{
    const api_uri = `http://www.youtube.com/get_video_info?video_id=${video_id}`;

    get(api_uri, (res) =>
    {
        const statusCode = res.statusCode;
        const contentType = res.headers['content-type'];

        let error;
        if (statusCode !== 200)
        {
            error = new Error(`Request Failed.\n` +
                            `Status Code: ${statusCode}`);
        }
        // else if (!/^application\/json/.test(contentType))
        // {
        //     error = new Error(`Invalid content-type.\n` +
        //                     `Expected application/json but received ${contentType}`);
        // }
        if (error)
        {
            fn(error.message);
            // consume response data to free up memory
            res.resume();
            return;
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => rawData += chunk);
        res.on('end', () =>
        {
            try
            {
                let parsedData = parse_querystring(rawData);
                let ret: { title: string, blocked: boolean } = { title: '', blocked: false };
                if ('title' in parsedData)
                {
                    ret.title = parsedData['title'];
                }
                else
                {
                    ret.blocked = true;
                }
                fn(null, ret);
            }
            catch (e)
            {
                fn(e.message);
            }
        });
    }).on('error', fn);
}
