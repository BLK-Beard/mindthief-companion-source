/// <reference lib="webworker" />
import {teachTurns} from './turnCoach';
import {challengeAdvice} from './advisorChallenge';
self.onmessage=event=>{try{const {cards,config,distance,turns,snapshot}=event.data;const draft=teachTurns(cards,config,distance,turns,snapshot);const result=challengeAdvice(draft,cards,config,snapshot);for(const sequence of result.sequences)for(const turn of sequence.turns){turn.notes=[];delete turn.action;}self.postMessage({result});}catch(error){self.postMessage({error:error instanceof Error?error.message:'Unable to plan this hand.'});}};
