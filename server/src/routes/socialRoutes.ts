import { Router } from 'express';
import * as social from '../controllers/socialController';
import { authenticate, validate } from '../middleware';
import {
  sendMessageSchema,
  createPollSchema,
  createTripNoteSchema,
  createFeedPostSchema,
} from '../validators';

const router = Router();

router.use(authenticate);

// Chat
router.get('/trips/:tripId/chat', social.getChatMessages);
router.post('/trips/:tripId/chat', validate({ body: sendMessageSchema }), social.sendChatMessage);

// Polls
router.get('/trips/:tripId/polls', social.getPolls);
router.post('/trips/:tripId/polls', validate({ body: createPollSchema }), social.createPoll);
router.post('/polls/:pollId/vote/:optionId', social.votePoll);
router.put('/polls/:pollId/close', social.closePoll);

// Notes
router.get('/trips/:tripId/notes', social.getTripNotes);
router.post('/trips/:tripId/notes', validate({ body: createTripNoteSchema }), social.createTripNote);
router.put('/trips/:tripId/notes/:noteId', social.updateTripNote);
router.delete('/trips/:tripId/notes/:noteId', social.deleteTripNote);

// Feed
router.get('/trips/:tripId/feed', social.getTripFeed);
router.post('/trips/:tripId/feed', validate({ body: createFeedPostSchema }), social.createFeedPost);
router.delete('/trips/:tripId/feed/:postId', social.deleteFeedPost);

export default router;
