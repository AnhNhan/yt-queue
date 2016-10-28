
import 'jasmine';

import { VideoEntry } from '../lib';

const loona = 'https://www.youtube.com/watch?v=-FCYE87P5L0';
const loona_id = '-FCYE87P5L0';
const lemans = 'https://www.youtube.com/watch?v=z7Oh9hcoDKM&feature=youtu.be';
const lemans_id = 'z7Oh9hcoDKM';

describe('Video ID Extraction', function() {
    it('can match straightforward video urls', function ()
    {
        expect((new VideoEntry('Loona', loona)).video_id).toBe(loona_id);
    });
    it('can match ids directly', function ()
    {
        expect((new VideoEntry('Loona', loona_id)).video_id).toBe(loona_id);
    });
    it('can match with other params in the url', function ()
    {
        expect(new VideoEntry('Le Mans', lemans).video_id).toBe(lemans_id);
    });
});
