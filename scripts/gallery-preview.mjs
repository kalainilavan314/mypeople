import express from '../node_modules/express/index.js';
import { galleryRouter } from '../server/src/gallery.js';
const app = express();
app.use('/api/gallery',galleryRouter);
app.listen(8788,'127.0.0.1',()=>console.log('Local gallery test API: 8788'));
