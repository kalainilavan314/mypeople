import { Router } from 'express';
import fs from 'node:fs/promises';

// Reviewed public metadata only. Editing this manifest replaces sample assets
// without changing the client. No identity, contact, or private evidence fields.
const manifest = new URL('./gallery-albums.json', import.meta.url);
export async function readGalleryAlbums() {
  const rows = JSON.parse(await fs.readFile(manifest, 'utf8'));
  return rows.filter(a => a.publicationState === 'published').map(a => ({
    id: a.id, titleEn: a.titleEn, titleTa: a.titleTa, category: a.category,
    publishedAt: a.publishedAt, place: a.place, publisher: a.publisher,
    sample: a.sample === true,
    photos: a.photos.map(p => ({ id: p.id, src: p.src, altEn: p.altEn,
      altTa: p.altTa, credit: p.credit, sourceUrl: p.sourceUrl,
      license: p.license, licenseUrl: p.licenseUrl })),
    count: a.photos.length,
  })).filter(a => a.photos.length > 0);
}

export const galleryRouter = Router();
galleryRouter.get('/albums', async (req,res,next) => {
  try {
    const category = req.query.category;
    if(category && !['all','events','community'].includes(category)) return res.status(400).json({error:'invalid_category'});
    const albums = await readGalleryAlbums();
    res.set('Cache-Control','public, max-age=60');
    res.json({ albums: albums.filter(a => !category || category==='all' || a.category===category) });
  } catch(e) { next(e); }
});
galleryRouter.get('/albums/:id', async (req,res,next) => {
  try {
    const album = (await readGalleryAlbums()).find(a => a.id === req.params.id);
    if(!album) return res.status(404).json({error:'not_found'});
    res.set('Cache-Control','public, max-age=60').json({album});
  } catch(e) { next(e); }
});
galleryRouter.use((error,_req,res,_next) => {
  console.error('Gallery manifest could not be read:', error.message);
  res.status(503).json({error:'gallery_unavailable'});
});
