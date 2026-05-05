import { Router } from 'express';
import * as note from '../controllers/noteController';
import { authenticate, validate } from '../middleware';
import { createNoteSchema, updateNoteSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.get('/:tripId/notes', note.getNotes);
router.post('/:tripId/notes', validate({ body: createNoteSchema }), note.createNote);
router.patch('/:tripId/notes/:noteId', validate({ body: updateNoteSchema }), note.updateNote);
router.patch('/:tripId/notes/:noteId/pin', note.togglePin);
router.delete('/:tripId/notes/:noteId', note.deleteNote);

export default router;
