/*eslint-env node, es6*/

/* Module Description */

const canvas = require('canvas-api-wrapper');
const cheerio = require('cheerio');
const xpath = require('xpath'),
    dom = require('xmldom').DOMParser;

module.exports = (course, stepCallback) => {
    let xpathQuizTitleSelector = '//assessment/@title';
    let xpathQuestionTextSelector = '//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Multi-Select"]/../../../../presentation/flow/material/mattext';

    function getXML(files) {
        return files.map(file => {
            return file.dom.xml();
        });
    }

    function getQuestionTitle(question) {
        let attrLength = question.attributes.length;
        if (question.nodeName === 'item') {
            for (let i = 0; i < attrLength; i++) {
                if (question.attributes[`${i}`].name === 'title') {
                    return question.attributes[`${i}`].nodeValue;
                }
            }
            return 'N/A';
        }
        if (question.parentNode !== undefined) {
            return getQuestionTitle(question.parentNode);
        } else {
            return 'N/A';
        }
    }

    function getQuestionObjects(xmlFiles) {
        let bsObjects = [];
        xmlFiles.forEach(xml => {
            let doc = new dom().parseFromString(xml);
            let quizTitle = xpath.select(xpathQuizTitleSelector, doc);
            let quizQuestionsText = xpath.select(xpathQuestionTextSelector, doc);
            if (quizTitle.length === 0) {
                quizTitle = 'Question Database';
            } else {
                quizTitle = quizTitle[0].value;
            }
            quizQuestionsText.forEach(quizQuestion => {
                let questionTitle = getQuestionTitle(quizQuestion);
                bsObjects.push({
                    quizTitle: quizTitle,
                    questionTitle: questionTitle,
                    questionText: quizQuestion.childNodes['0'].data
                });
            });
        });
        return bsObjects;
    }
    async function searchCanvasQuizzes(courseId) {
        let courseQuizzes = await canvas.get(`/api/v1/courses/${courseId}/quizzes`);
        for (let quiz in courseQuizzes) {
            courseQuizzes[quiz]._questions = await canvas.get(`/api/v1/courses/${courseId}/quizzes/${courseQuizzes[quiz].id}/questions`);
        }
        return courseQuizzes;
    }

    function checkQuizTitles(bsQuizTitle, cQuizTitle) {
        return bsQuizTitle.toLowerCase() === cQuizTitle.toLowerCase();
    }

    function checkQuestionsTitles(bsQuestionTitle, cQuestionTitle) {
        return bsQuestionTitle === cQuestionTitle;
    }

    function checkQuestionText(bsQuestionText, cQuestionText) {
        let $ = cheerio.load(bsQuestionText);
        bsQuestionText = $(bsQuestionText).text();
        cheerio.load(cQuestionText);
        cQuestionText = $(cQuestionText).text();
        return cQuestionText.toLowerCase() === bsQuestionText.toLowerCase();
    }

    function compareQuestions(bsQuizObjects, cQuizObjects) {
        let badQuestions = [];
        cQuizObjects.forEach(cQuizObject => {
            let cQuizTitle = cQuizObject.quizTitle;
            cQuizObject.mcQuestions.forEach(mcQuestion => {
                let cQuestionTitle = mcQuestion.question_name;
                let cQuestionText = mcQuestion.question_text;
                bsQuizObjects.forEach(bsQuizObject => {
                    if (checkQuizTitles(bsQuizObject.quizTitle, cQuizTitle)) {
                        if (bsQuizObject.questionTitle !== 'N/A') {
                            if (checkQuestionsTitles(bsQuizObject.questionTitle, cQuestionTitle)) {
                                if (checkQuestionText(bsQuizObject.questionText, cQuestionText)) {
                                    badQuestions.push(mcQuestion);
                                }
                            }
                        } else {
                            if (checkQuestionText(bsQuizObject.questionText, cQuestionText)) {
                                badQuestions.push(mcQuestion);
                            }
                        }
                    }
                });
            });
        });
        return badQuestions;
    }

    // Start Here
    try {
        let files = course.content.filter(file => /^quiz_d2l/.test(file.name) || /^questiondb/.test(file.name));
        let xmlData = getXML(files);
        let questionObjects = getQuestionObjects(xmlData);
        if (questionObjects.length > 0) {
            searchCanvasQuizzes(course.info.canvasOU).then(courseQuizzes => {
                courseQuizzes = courseQuizzes.filter(quiz => {
                    return quiz._questions.length > 0;
                });
                let mcQuestionObjects = courseQuizzes.map(quiz => {
                    let mcQuestions = quiz._questions.filter(question => question.question_type === 'multiple_choice_question');
                    return {
                        quizTitle: quiz.title,
                        mcQuestions
                    };
                });
                mcQuestionObjects = mcQuestionObjects.filter(mcQuestionObject => mcQuestionObject.mcQuestions.length > 0);
                let badQuestions = compareQuestions(questionObjects, mcQuestionObjects);
                console.log(badQuestions);
            }, (err) => {
                course.error(err);
            });
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