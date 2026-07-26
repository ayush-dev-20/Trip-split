import { Router } from 'express';
import * as note from '../controllers/personalNoteController';
import { authenticate, validate } from '../middleware';
import { createNoteSchema, updateNoteSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.get('/notes', note.getNotes);
router.post('/notes', validate({ body: createNoteSchema }), note.createNote);
router.patch('/notes/:noteId', validate({ body: updateNoteSchema }), note.updateNote);
router.patch('/notes/:noteId/pin', note.togglePin);
router.delete('/notes/:noteId', note.deleteNote);

export default router;
