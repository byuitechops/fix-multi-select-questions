/*eslint-env node, es6*/

/* Module Description */

/* Put dependencies here */

/* Include this line only if you are going to use Canvas API */
// const canvas = require('canvas-wrapper');
const xpath = require('xpath'),
    dom = require('xmldom').DOMParser;

module.exports = (course, stepCallback) => {
    function getXML(files) {
        return files.map(file => {
            return file.dom.xml();
        });
    }

    function getLabels(xmlData) {
        let nodesData = xmlData.map(xml => {
            let doc = new dom().parseFromString(xml);
            return xpath.select('//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Multi-Select"]/../../../../@label', doc);
        });
        nodesData = nodesData.filter(nodes => nodes.length > 0);
        return nodesData.map(nodes => {
            return nodes.map(node => {
                return node.value;
            });
        });
    }

    // Start Here
    try {
        let files = course.content.filter(file => /^quiz_d2l/.test(file.name) || /^questiondb/.test(file.name));
        let xmlData = getXML(files);
        let questionLabels = getLabels(xmlData);
        if (questionLabels.length > 0) {
            // TODO: Compare D2l and Canvas Questions
        } else {
            course.log('fix-multi-select-questions', {
                status: 'No multi-select questions found'
            });
            stepCallback(null, course);
        }
    } catch (err) {
        // catch all uncaught errors. Don't pass errors here on purpose
        course.error(err);
        stepCallback(null, course);
        return;
    }
};