/**
 * The MIT License (MIT)
 *
 * Igor Zinken 2016 - http://www.igorski.nl
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
module.exports =
{
    INSTRUMENT_AMOUNT           : 8,

    DEFAULT_FILTER_FREQ         : 880,
    DEFAULT_FILTER_Q            : 5,

    DEFAULT_FILTER_LFO_SPEED    : .5,
    DEFAULT_FILTER_LFO_DEPTH    : 50,

    DEFAULT_DELAY_MIX           : .65,
    DEFAULT_DELAY_FEEDBACK      : 0.0000001,
    DEFAULT_DELAY_TIME          : 0.33,
    DEFAULT_DELAY_CUT_OFF       : 1500,

    /**
     * return the path to the Worker scripts relative from the applications address
     * as Worker location can differ dependent on the production environment
     *
     * @public
     * @return {string}
     */
    getWorkerPath : function()
    {
        return ( typeof window.workerPath === "string" ) ? window.workerPath : "";
    }
};