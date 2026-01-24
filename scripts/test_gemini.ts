import { InspirationService } from '../src/engine/InspirationService';

async function test() {
    console.log("Initializing InspirationService...");
    const service = new InspirationService();

    console.log("Sending test request...");
    const context = "The cat sat on the mat";
    const targets = ["hat", "bat"];

    const result = await service.generate({
        context,
        targets,
        rhymeCandidates: []
    });

    console.log("Result received:");
    console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
