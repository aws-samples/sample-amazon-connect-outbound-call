/*
Copyright 2024 Amazon.com, Inc. and its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License").
You may not use this file except in compliance with the License.
A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language governing
permissions and limitations under the License.
*/

export default function generateRandomPassword(length: number): string {
  const upperCaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowerCaseChars = "abcdefghijklmnopqrstuvwxyz";
  const numberChars = "0123456789";

  // Ensure at least one character from each set is included
  let password = [
    upperCaseChars.charAt(Math.floor(Math.random() * upperCaseChars.length)),
    lowerCaseChars.charAt(Math.floor(Math.random() * lowerCaseChars.length)),
    numberChars.charAt(Math.floor(Math.random() * numberChars.length)),
  ];

  // Fill the rest of the password length with a mix of all character sets
  const allChars = upperCaseChars + lowerCaseChars + numberChars;
  for (let i = 3; i < length; i++) {
    password.push(allChars.charAt(Math.floor(Math.random() * allChars.length)));
  }

  // Shuffle the password array to ensure randomness
  password = password.sort(() => Math.random() - 0.5);

  return password.join("");
}
