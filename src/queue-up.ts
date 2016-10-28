
import * as Promise from 'bluebird';
import { retrieve_data, write_data, create_video_entry, queue_lock_path, semaphoreP } from './lib';

const args = process.argv.slice(2);

semaphoreP(queue_lock_path)
    .then(() =>
        retrieve_data()
    )
    .then((data) =>  Promise.all(args.map(create_video_entry))
            .then((new_entries) => data.concat(new_entries || [ ]))
    )
    .then(write_data)
    .then(() => console.log('Added video(s)'))
;
