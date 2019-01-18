/*eslint-env node, es6*/

/* Module Description */

const canvas = require('canvas-api-wrapper');
const cheerio = require('cheerio');
const xpath = require('xpath'),
    dom = require('xmldom').DOMParser;

module.exports = (course, stepCallback) => {
    // Define the xPath selectors needed to traverse the xml
    let xpathQuizTitleSelector = '//assessment/@title';
    let xpathQuestionTextSelector = '//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Multi-Select"]/../../../../presentation/flow/material/mattext';

    /****************************************************
     *                      getXML()
     * 
     * Parameters: files: Array[Object]
     * 
     * Description:
     * The getXML() function recieves a list of xml files
     * and returns a list of the content of each xml file.
     * 
     * Return Type: Array[String]
     * 
     ****************************************************/
    function getXML(files) {
        // Return an Array of string containing the content of each xml file.
        return files.map(file => {
            return file.dom.xml();
        });
    }

    /****************************************************
     *                 getQuestionTitle()
     * 
     * Parameters: xmlQuestion: Object{}
     * 
     * Description:
     * The getQuestionTitle() function recieves a 
     * xmlQuestion object and retrieves a question title.
     * This is done by climbing up the object's parent 
     * nodes until it reaches an "item" element. When 
     * the item element is found it looks for a title
     * attribute. If one is found it returns its value.
     * 
     * Return Type: String
     * 
     ****************************************************/
    function getQuestionTitle(xmlQuestion) {
        // Gets the current length of the attributes attached to the xmlQuestion object
        let attrLength = xmlQuestion.attributes.length;
        // If the nodeName key on the object is item we can extract the question title
        if (xmlQuestion.nodeName === 'item') {
            // Loop through each attribute
            for (let i = 0; i < attrLength; i++) {
                // Check if the current attribute is the title attribute
                if (xmlQuestion.attributes[`${i}`].name === 'title') {
                    // Return the value of the title attribute
                    return xmlQuestion.attributes[`${i}`].nodeValue;
                }
            }
            // The question does not have a title
            return 'N/A';
        }
        // The nodeName was not item. Check if it has a parent
        if (xmlQuestion.parentNode !== undefined) {
            // Recursivly call getQuestionTitle() until we reach the "item" node. Return the title when we do.
            return getQuestionTitle(xmlQuestion.parentNode);
        } else {
            // The top of the document was reached. The "item" node wasn't found
            return 'N/A';
        }
    }

    /****************************************************
     *                getQuestionObjects()
     * 
     * Parameters: xmlFiles: Array[String]
     * 
     * Description:
     * The getQuestionObjects() function recieves a list
     * of quiz xml strings. The function loops through each
     * xml files and searches it for the quiz title,
     * question title, and question text. Once all
     * three have been found it creates an object out
     * of them and pushes the newly created object onto
     * an array.
     * 
     * Return Type: Array[Object]
     * 
     ****************************************************/
    function getQuestionObjects(xmlFiles) {
        // Create an array that will hold the Brightspace Objects
        let bsObjects = [];
        // Loop through each xml file to extract the neccessary information for comparison
        xmlFiles.forEach(xml => {
            // Use xPath to extract the data from the xml string
            let doc = new dom().parseFromString(xml);
            let quizTitle = xpath.select(xpathQuizTitleSelector, doc);
            let quizQuestionsText = xpath.select(xpathQuestionTextSelector, doc);
            // If the quiz title's length is 0 this is the question database.
            if (quizTitle.length === 0) {
                quizTitle = 'Question Database';
            } else {
                // Set the quiz title
                quizTitle = quizTitle[0].value;
            }
            // Loop through each multi-select question on the quiz, extract the question title, and push on a pretty question object to the bsObjects array
            quizQuestionsText.forEach(quizQuestion => {
                // Get the question title
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

    /****************************************************
     *               searchCanvasQuizzes()
     * 
     * Parameters: courseID: Number
     * 
     * Description:
     * The searchCanvasQuizzes() function recives a
     * courseID and uses it to retrieve all of the
     * quizzes in the corresponding course. Once all of
     * the quizzes have been retrieved the function
     * iterates over each quiz and gets the questions
     * for that quiz and appends them to the quiz object.
     * 
     * Return Type: Array[Object]
     * 
     ****************************************************/
    async function searchCanvasQuizzes(courseID) {
        // Get all of the quizzes out of the Canvas Course
        let courseQuizzes = await canvas.get(`/api/v1/courses/${courseID}/quizzes`);
        // Loop through each quiz
        for (let quiz in courseQuizzes) {
            // Extract the questions from the current quiz
            courseQuizzes[quiz]._questions = await canvas.get(`/api/v1/courses/${courseID}/quizzes/${courseQuizzes[quiz].id}/questions`);
        }
        // Return all of the quizzes with their questions attached
        return courseQuizzes;
    }

    /****************************************************
     *                 checkQuizTitles()
     * 
     * Parameters: bsQuizTitle: String, 
     * cQuizTitle: String
     * 
     * Description:
     * Compares a Brightspace quiz title with a
     * Canvas Quiz title.
     * 
     * Return Type: Boolean
     * 
     ****************************************************/
    function checkQuizTitles(bsQuizTitle, cQuizTitle) {
        // Check if the Brightspace quiz title and the Canvas quiz title match
        return bsQuizTitle.toLowerCase() === cQuizTitle.toLowerCase();
    }

    /****************************************************
     *               checkQuestionTitles()
     * 
     * Parameters: bsQuestionTitle: String, 
     * cQuestionTitle: String
     * 
     * Description:
     * Compares a Brightspace question title with a
     * Canvas Question title.
     * 
     * Return Type: Boolean
     * 
     ****************************************************/
    function checkQuestionsTitles(bsQuestionTitle, cQuestionTitle) {
        // Check if the Brightspace question title and the Canvas question title match
        return bsQuestionTitle === cQuestionTitle;
    }

    /****************************************************
     *                checkQuestionText()
     * 
     * Parameters: bsQuestionText: String, 
     * cQuestionText: String
     * 
     * Description:
     * Compares a Brightspace question text with a
     * Canvas Question text.
     * 
     * Return Type: Boolean
     * 
     ****************************************************/
    function checkQuestionText(bsQuestionText, cQuestionText) {
        // Load the Brightspace question html text into cheerio
        let $ = cheerio.load(bsQuestionText);
        // Get just the text out of the Brightspace question
        bsQuestionText = $(bsQuestionText).text();
        // Load the Canvas question html text into cheerio
        cheerio.load(cQuestionText);
        // Get just the text out of the Canvas question
        cQuestionText = $(cQuestionText).text();
        // Check if the text is a match
        return cQuestionText.toLowerCase() === bsQuestionText.toLowerCase();
    }

    /****************************************************
     *               checkQuestionTitles()
     * 
     * Parameters: bsQuizObjects: Array[Object], 
     * cQuizObjects: Array[Object]
     * 
     * Description:
     * 
     * 
     * Return Type: Array[Object]
     * 
     ****************************************************/
    function compareQuestions(bsQuizObjects, cQuizObjects) {
        // Create an array to hold a multiple choice question that matches with a multi-select question
        let badQuestions = [];
        // Iterate over each canvas quiz object
        cQuizObjects.forEach(cQuizObject => {
            // Get the quiz title out of the object
            let cQuizTitle = cQuizObject.quizTitle;
            // Iterate over each multiple choice question inside of the current quiz object
            cQuizObject.mcQuestions.forEach(mcQuestion => {
                // Get the current question's tile and text
                let cQuestionTitle = mcQuestion.question_name;
                let cQuestionText = mcQuestion.question_text;
                // Loop through the Brightspace quiz objects
                bsQuizObjects.forEach(bsQuizObject => {
                    // Start comparing the current brightspace quiz with the current canvas multiple choice question
                    if (checkQuizTitles(bsQuizObject.quizTitle, cQuizTitle)) {
                        // Check if the question title exists
                        if (bsQuizObject.questionTitle !== 'N/A') {
                            // The title exists, now run comparisons against title and text
                            if (checkQuestionsTitles(bsQuizObject.questionTitle, cQuestionTitle)) {
                                if (checkQuestionText(bsQuizObject.questionText, cQuestionText)) {
                                    // Match found, push the Canvas multiple choice question onto the badQuestions array
                                    badQuestions.push(mcQuestion);
                                }
                            }
                        } else {
                            // The question title does not exist, just compare question text
                            if (checkQuestionText(bsQuizObject.questionText, cQuestionText)) {
                                // Match found, push the Canvas multiple choice question onto the badQuestions array
                                badQuestions.push(mcQuestion);
                            }
                        }
                    }
                });
            });
        });
        return badQuestions;
    }

    /********************************************
     *                  getXML()
     * 
     * Parameters:
     * 
     * Description:
     * 
     * Return Type:
     * 
     ********************************************/
    async function fixBadQuestions(courseID, badQuestions) {
        // Create an array that will hold the fixed questions
        let fixedQuestions = [];
        // Iterate over all the bad questinos
        for (let badQuestion in badQuestions) {
            // Get the current badQuestion object
            let currBadQuestion = badQuestions[badQuestion];
            // Get the quiz and question ID
            let quizID = currBadQuestion.quiz_id;
            let questionID = currBadQuestion.id;
            // Make the put request changing the question type from multiple choice question to multipe answers question
            let response = await canvas.put(`/api/v1/courses/${courseID}/quizzes/${quizID}/questions/${questionID}`, {
                'question[question_type]': 'multiple_answers_question'
            });
            // Push the response onto the fixedQuestions array
            fixedQuestions.push(response);
        }
        return fixedQuestions;
    }

    /********************************************
     *                printResult()
     * 
     * Parameters:
     * 
     * Description:
     * 
     * Return Type:
     * 
     ********************************************/
    function printResult(fixedQuestions) {
        // Check if any fixed questions were returned
        if (fixedQuestions.length > 0) {
            // At least one fixed question was returned. Log the success
            course.log('fix-multi-select-questions', {
                status: 'Bad Multiple Choice questions successfully converted to Multiple Answers Questions'
            });
        } else {
            // No fixed questions were returned. Log the failure
            course.error('fix-multi-select-questions', {
                status: 'Bad Multiple Choice questions unsuccessfully converted to Multiple Answers Questions'
            });
        }
        // Continue on to the next child module
        stepCallback(null, course);
    }

    /********************************************
     *                  getXML()
     * 
     * Parameters:
     * 
     * Description:
     * 
     * Return Type:
     * 
     ********************************************/
    function runQuestionTasks(questionObjects, courseQuizzes) {
        // Remove all quizzes that don't have any questions attached to them
        courseQuizzes = courseQuizzes.filter(quiz => {
            return quiz._questions.length > 0;
        });
        // Create canvas multiple choice question objects that contain the quiz title and only the multiple choice questions objects
        let mcQuestionObjects = courseQuizzes.map(quiz => {
            // Filter out any question that is not a multiple choice question
            let mcQuestions = quiz._questions.filter(question => question.question_type === 'multiple_choice_question');
            return {
                quizTitle: quiz.title,
                mcQuestions
            };
        });
        // Filter out the mcQuestionObjects that contained no multiple choice questions
        mcQuestionObjects = mcQuestionObjects.filter(mcQuestionObject => mcQuestionObject.mcQuestions.length > 0);
        // Compare all of the Brightspace multi-select questions with the Canvas multiple choice questions
        let badQuestions = compareQuestions(questionObjects, mcQuestionObjects);
        // Check if there were any identical questions
        if (badQuestions.length > 0) {
            // At least one question was identical. Now fix the bad multiple choice question(s)
            fixBadQuestions(course.info.canvasOU, badQuestions).then(printResult, err => {
                // There was an error fixing questions, continue on to the next child module
                stepCallback(null, course);
            });
        } else {
            // No identical questions found
            course.log('fix-multi-select-questions', {
                status: 'No bad questions found'
            });
            // Continue on to the next child module
            stepCallback(null, course);
        }
    }

    // Start Here
    try {
        // Get all quiz files and the question database
        let files = course.content.filter(file => /^quiz_d2l/.test(file.name) || /^questiondb/.test(file.name));
        // Get an array of strings. Each string contains the contents of an xml file
        let xmlData = getXML(files);
        // Get pretty question objects that contain the quiz title, question title, and question text
        let questionObjects = getQuestionObjects(xmlData);
        // Check if there are any multi-select questions in the brightspace course
        if (questionObjects.length > 0) {
            // There is at least 1 multi-select question. Now get the Canvas quizzes
            searchCanvasQuizzes(course.info.canvasOU).then(courseQuizzes => {
                // This function takes charge of running the comparisons and fixes to quiz questions
                runQuestionTasks(questionObjects, courseQuizzes);
            }, (err) => {
                throw err;
            });
        } else {
            // No multi-select question were found in the brightspace course. Therefore it is impossible to have any incorrect multiple choice in Canvas
            course.log('fix-multi-select-questions', {
                status: 'No multi-select questions found'
            });
            // Continue on to the next child module
            stepCallback(null, course);
        }
    } catch (err) {
        // catch all uncaught errors. Don't pass errors here on purpose
        course.error(err);
        stepCallback(null, course);
        return;
    }
};