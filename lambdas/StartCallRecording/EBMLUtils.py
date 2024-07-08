'''
Copyright 2024 Amazon.com, Inc. and its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License").
You may not use this file except in compliance with the License.
A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language governing
permissions and limitations under the License.
'''

from io import BytesIO
import wave
from ebmlite import core
from pydub import AudioSegment
import tempfile

BYTE_WITH_FIRST_BIT_SET = 0b10000000
EBML_ID_MAX_BYTES = 4
EBML_SIZE_MAX_BTYES = 8
BYTE_SIZE = 8
INT_SIZE = 32


def get_fragment_tags(fragment_dom):
    '''
    Parses a MKV Fragment Doc (of type ebmlite.core.MatroskaDocument) that is returned to the provided callback 
    from get_streaming_fragments() in this class and returns a dict of the SimpleTag elements found. 

    ### Parameters:

        **fragment_dom**: ebmlite.core.Document <ebmlite.core.MatroskaDocument>
            The DOM like structure describing the fragment parsed by EBMLite. 

    ### Returns:

        simple_tags: dict

        Dictionary of all SimpleTag elements with format -  TagName<String> : TagValue <String | Binary>. 

    '''

    # Get the Segment Element of the Fragment DOM - error if not found
    segment_element = None
    for element in fragment_dom:
        if (element.id == 0x18538067):          # MKV Segment Element ID
            segment_element = element
            break

    if (not segment_element):
        raise KeyError(
            'Segment Element required but not found in fragment_doc')

    # Save all of the SimpleTag elements in the Segment element
    simple_tag_elements = []
    for element in segment_element:
        if (element.id == 0x1254C367):                      # Tags element type ID
            for tags in element:
                if (tags.id == 0x7373):                 # Tag element type ID
                    for tag_type in tags:
                        if (tag_type.id == 0x67C8):    # SimpleTag element type ID
                            simple_tag_elements.append(tag_type)

    # For all SimpleTags types (ID: 0x67C8), save for TagName (ID: 0x7373) and values of TagString (ID:0x4487) or TagBinary (ID: 0x4485 )
    simple_tags_dict = {}
    for simple_tag in simple_tag_elements:

        tag_name = None
        tag_value = None
        for element in simple_tag:
            if (element.id == 0x45A3):                              # Tag Name element type ID
                tag_name = element.value
            # TagString and TagBinary element type IDs respectively
            elif (element.id == 0x4487 or element.id == 0x4485):
                tag_value = element.value

        # As long as tag name was found add the Tag to the return dict.
        if (tag_name):
            simple_tags_dict[tag_name] = tag_value

    return simple_tags_dict


def getEbmlHeaderElements(fragment_dom):
    ebml_header_elements = []

    for element in fragment_dom:
        if (element.id == 0x1A45DFA3):   # EBML (Master) element ID = 0x1A45DFA3 (440786851 dec)
            ebml_header_elements.append(element)

    return ebml_header_elements


def getNumLeadingZeros(i):
    '''
    Gets the number of leading zero bits in the specified integer as if it were a byte (to avoid a cast).
    This is the "count leading zeroes" problem: http://en.wikipedia.org/wiki/Find_first_set
    Intel processors actually have this as a built-in instruction but we can't access that from the JVM.
    '''

    if i == 0:
        return 32
    n = 0
    if i < 0:
        i = ~i
    while i != 0:
        i >>= 1
        n += 1
    return 32 - n - (INT_SIZE-BYTE_SIZE)


def readUnsignedIntegerSevenByteOrLess(byteBuffer, size):
    '''
    A specialized method used to read a variable length unsigned integer of size 7 bytes or less.
    '''
    value = 0
    for i in range(size):
        result = byteBuffer.pop(0) & 0xFF
        value = (value << 8) | result

    return value


def readDataSignedInteger(byteBuffer, size):
    if not (size >= 0 and size <= EBML_SIZE_MAX_BTYES):
        raise ValueError(f"Asked for a numeric value of invalid size {size}")

    value = 0
    for i in range(size):
        result = byteBuffer.pop(0) & 0xFF
        if i == 0:
            positive = (result & 0x80) == 0
            if not positive:
                value = -1

        value = (value << BYTE_SIZE) | result

    return value


def readEbmlnt(buffer) -> int:
    '''
    Read an EBML integer value of varying length fro the provided buffer
    See Also: "http://www.matroska.org/technical/specs/rfc/index.html"
    '''
    firstByte = buffer.pop(0) & 0xFF

    if firstByte < 0:
        raise ValueError(f"EBML Int has negative firstByte {firstByte}")

    size = getNumLeadingZeros(firstByte)

    rest = readUnsignedIntegerSevenByteOrLess(buffer, size)

    return ((firstByte & ~(BYTE_WITH_FIRST_BIT_SET >> size)) << (size * BYTE_SIZE) | rest)


def getSimpleBlock(fragment_dom):
    for el1 in fragment_dom:
        for el2 in el1:
            if (isinstance(el2, core.MasterElement)):
                for el3 in el2:
                    if (el3.name == "SimpleBlock"):
                        yield el3


def getTrackName(fragment_tags, trackNumber):
    if (fragment_tags['AUDIO_FROM_CUSTOMER'] == str(trackNumber)):
        return "AUDIO_FROM_CUSTOMER"
    elif (fragment_tags['AUDIO_TO_CUSTOMER'] == str(trackNumber)):
        return "AUDIO_TO_CUSTOMER"
    return "UNKNOWN"


def saveBuffer(audio_buffer, contactId, trackName):
    # WAV parameters
    nchannels = 1  # mono
    sampwidth = 2  # 16-bit
    framerate = 8000
    nframes = len(audio_buffer) // sampwidth

    with wave.open(f"{tempfile.gettempdir()}/{contactId}_{trackName}.wav", "wb") as wavfile:
        wavfile.setparams((nchannels, sampwidth, framerate,
                           nframes, 'NONE', 'not compressed'))
        wavfile.writeframes(audio_buffer)


def combineAudio(contactId, buffer1, buffer2):
    sound1 = AudioSegment.from_raw(
        buffer1, sample_width=2, frame_rate=8000, channels=1)
    sound2 = AudioSegment.from_raw(
        buffer2, sample_width=2, frame_rate=8000, channels=1)

    combinedTrack = sound1.overlay(sound2)

    combBuffer = BytesIO()

    combinedTrack.export(combBuffer, format='WAV')

    return combBuffer


class Frame:
    def __init__(self, buffer):
        '''
        Initialize someting
        '''

        # localBuf = element.value

        # Get the Track Number
        self.trackNumber = readEbmlnt(buffer)

        self.timeCode = readDataSignedInteger(buffer, 2)
        self.flag = readUnsignedIntegerSevenByteOrLess(buffer, 1)

        # Get the rest of the data
        self.frameData = buffer
