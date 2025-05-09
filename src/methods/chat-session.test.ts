/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect, use } from "chai";
import { match, restore, stub, useFakeTimers } from "sinon";
import * as sinonChai from "sinon-chai";
import * as chaiAsPromised from "chai-as-promised";
import * as generateContentMethods from "./generate-content";
import { GenerateContentStreamResult } from "../../types";
import { ChatSession } from "./chat-session";
import { getMockResponse } from "../../test-utils/mock-response";
import * as request from "../requests/request";

use(sinonChai);
use(chaiAsPromised);

describe("ChatSession", () => {
  afterEach(() => {
    restore();
  });
  describe("sendMessage()", () => {
    it("generateContent errors should be catchable", async () => {
      const generateContentStub = stub(
        generateContentMethods,
        "generateContent",
      ).rejects("generateContent failed");
      const chatSession = new ChatSession("MY_API_KEY", "a-model");
      await expect(chatSession.sendMessage("hello")).to.be.rejected;
      expect(generateContentStub).to.be.calledWith(
        "MY_API_KEY",
        "a-model",
        match.any,
      );
    });
    it("generateContent errors should not persist", async () => {
      const generateContentStub = stub(
        generateContentMethods,
        "generateContent",
      ).rejects("generateContent failed");
      const chatSession = new ChatSession("MY_API_KEY", "a-model");
      await expect(chatSession.sendMessage("hello")).to.be.rejected;
      expect(generateContentStub).to.be.calledWith(
        "MY_API_KEY",
        "a-model",
        match.any,
      );
      restore();

      // Subsequent call should succeed.
      const mockResponse = getMockResponse(
        "unary-success-basic-reply-short.json",
      );
      stub(request, "makeModelRequest").resolves(mockResponse as Response);
      await expect(chatSession.sendMessage("hello")).to.not.be.rejected;
    });
  });
  describe("sendMessageRecitationErrorNotAddingResponseToHistory()", () => {
    it("generateContent errors should be catchable", async () => {
      const mockResponse = getMockResponse("unary-failure-citations.json");
      stub(request, "makeModelRequest").resolves(mockResponse as Response);
      const chatSession = new ChatSession("MY_API_KEY", "a-model");
      await chatSession.sendMessage("hello");
      expect((await chatSession.getHistory()).length).equals(0);
    });
  });
  describe("sendMessageStream()", () => {
    it("generateContentStream errors should be catchable", async () => {
      const clock = useFakeTimers();
      const consoleStub = stub(console, "error");
      const generateContentStreamStub = stub(
        generateContentMethods,
        "generateContentStream",
      ).rejects("generateContentStream failed");
      const chatSession = new ChatSession("MY_API_KEY", "a-model");
      await expect(chatSession.sendMessageStream("hello")).to.be.rejected;
      expect(generateContentStreamStub).to.be.calledWith(
        "MY_API_KEY",
        "a-model",
        match.any,
      );
      await clock.runAllAsync();
      expect(consoleStub).to.not.be.called;
      clock.restore();
    });
    it("downstream sendPromise errors should log but not throw", async () => {
      const clock = useFakeTimers();
      const consoleStub = stub(console, "error");
      // make candidates error when read as an array
      const generateContentStreamStub = stub(
        generateContentMethods,
        "generateContentStream",
      ).resolves({ candidates: 3 } as unknown as GenerateContentStreamResult);
      const chatSession = new ChatSession("MY_API_KEY", "a-model");
      await chatSession.sendMessageStream("hello");
      expect(generateContentStreamStub).to.be.calledWith(
        "MY_API_KEY",
        "a-model",
        match.any,
      );
      await clock.runAllAsync();
      expect(consoleStub.args[0][0].toString()).to.include(
        "properties of undefined",
      );
      clock.restore();
    });
  });
});
